/**
 * 
 */

import { EventEmitter } from 'events';
import {
  McpConnectionStatus,
  McpToolDefinition,
  McpToolCallResponse,
  McpServerConfig,
  HealthCheckConfig,
  ErrorType,
  ClassifiedError,
  DEFAULT_CONNECTION_CONFIG,
  type McpClientInterface,
} from './types.js';
import { HealthMonitor } from './HealthMonitor.js';
import { createDebugLogger } from '../utils/debug.js';

/**
 * 
 */
function classifyError(error: unknown): ClassifiedError {
  if (!(error instanceof Error)) {
    return {
      type: ErrorType.UNKNOWN,
      isRetryable: false,
      originalError: new Error(String(error)),
    };
  }

  const msg = error.message.toLowerCase();
  const permanentErrors = [
    'command not found',
    'no such file',
    'permission denied',
    'invalid configuration',
    'enoent',
    'spawn',
  ];
  if (permanentErrors.some(p => msg.includes(p))) {
    return { type: ErrorType.CONFIG_ERROR, isRetryable: false, originalError: error };
  }
  if (msg.includes('unauthorized') || msg.includes('401') || msg.includes('authentication failed')) {
    return { type: ErrorType.AUTH_ERROR, isRetryable: false, originalError: error };
  }
  const temporaryErrors = [
    'timeout',
    'connection refused',
    'network error',
    'rate limit',
    '503',
    '429',
    'econnrefused',
    'etimedout',
  ];
  if (temporaryErrors.some(t => msg.includes(t))) {
    return { type: ErrorType.NETWORK_TEMPORARY, isRetryable: true, originalError: error };
  }
  return { type: ErrorType.UNKNOWN, isRetryable: true, originalError: error };
}

/**
 */
export class McpClient extends EventEmitter implements McpClientInterface {
  private status: McpConnectionStatus = McpConnectionStatus.DISCONNECTED;
  private sdkClient: any = null;  // @modelcontextprotocol/sdk Client
  private tools = new Map<string, McpToolDefinition>();
  private serverInfo: { name: string; version: string } | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isManualDisconnect = false;
  private healthMonitor: HealthMonitor | null = null;
  public readonly serverName: string;
  
  // Debug logger
  private debug: ReturnType<typeof createDebugLogger>;

  constructor(
    private config: McpServerConfig,
    serverName?: string,
    healthCheckConfig?: HealthCheckConfig
  ) {
    super();
    this.serverName = serverName || 'default';
    this.debug = createDebugLogger(`McpClient:${this.serverName}`);
    if (healthCheckConfig?.enabled) {
      this.healthMonitor = new HealthMonitor(this, healthCheckConfig);
      this.healthMonitor.on('unhealthy', (failures: number, error: Error) => {
        this.emit('unhealthy', failures, error);
        if (this.status === McpConnectionStatus.CONNECTED) {
          this.handleUnexpectedClose();
        }
      });
    }
  }

  /**
   * 
   */
  get connectionStatus(): McpConnectionStatus {
    return this.status;
  }

  /**
   * 
   */
  get availableTools(): McpToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * 
   */
  private setStatus(status: McpConnectionStatus): void {
    const oldStatus = this.status;
    this.status = status;
    if (oldStatus !== status) {
      this.emit('statusChanged', status, oldStatus);
    }
  }

  /**
   * 
   */
  async connectWithRetry(
    maxRetries = DEFAULT_CONNECTION_CONFIG.maxRetries,
    initialDelay = DEFAULT_CONNECTION_CONFIG.initialDelay
  ): Promise<void> {
    if (this.status !== McpConnectionStatus.DISCONNECTED) {
      throw new Error('');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.doConnect();
        this.reconnectAttempts = 0;
        return;
      } catch (error) {
        lastError = error as Error;
        const classified = classifyError(error);

        this.debug.warn(
          `（${attempt}/${maxRetries}）:`,
          classified.type,
          (error as Error).message
        );
        if (!classified.isRetryable) {
          this.debug.error(`，`);
          throw error;
        }
        if (attempt < maxRetries) {
          const delay = initialDelay * Math.pow(2, attempt - 1);
          this.debug.log(`${delay}ms ...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('');
  }

  /**
   * 
   */
  private async doConnect(): Promise<void> {
    try {
      this.setStatus(McpConnectionStatus.CONNECTING);
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      this.sdkClient = new Client(
        { name: 'aegis', version: '1.0.0' },
        { capabilities: { roots: { listChanged: true }, sampling: {} } }
      );
      this.sdkClient.onclose = () => this.handleUnexpectedClose();
      const transport = await this.createTransport();
      await this.sdkClient.connect(transport);
      const serverVersion = this.sdkClient.getServerVersion?.();
      this.serverInfo = {
        name: serverVersion?.name || 'Unknown',
        version: serverVersion?.version || '0.0.0',
      };
      await this.loadTools();

      this.setStatus(McpConnectionStatus.CONNECTED);
      this.emit('connected', this.serverInfo);
      if (this.healthMonitor) {
        this.healthMonitor.start();
      }

      this.debug.log(
        `:`,
        this.serverInfo.name,
        `v${this.serverInfo.version}`,
        `(${this.tools.size} )`
      );
    } catch (error) {
      this.setStatus(McpConnectionStatus.ERROR);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 
   */
  private async createTransport(): Promise<any> {
    const { type, command, args, env, cwd, url, headers } = this.config;

    if (type === 'stdio') {
      if (!command) {
        throw new Error('stdio  command ');
      }

      const { StdioClientTransport } = await import(
        '@modelcontextprotocol/sdk/client/stdio.js'
      );

      // Whitelist — skicka bara säkra env-variabler till MCP child processes
      const SAFE_ENV_KEYS = ['PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'LC_ALL', 'TERM', 'TZ'];
      const mergedEnv: Record<string, string> = {};
      for (const key of SAFE_ENV_KEYS) {
        const value = process.env[key];
        if (value !== undefined) mergedEnv[key] = value;
      }
      // Tillåt explicit konfigurerade env-variabler från MCP-serverns config
      if (env) {
        Object.assign(mergedEnv, env);
      }

      return new StdioClientTransport({
        command,
        args: args || [],
        env: mergedEnv,
        cwd: cwd || process.cwd(),
        stderr: 'ignore',
      });
    }

    if (type === 'sse') {
      if (!url) {
        throw new Error('sse  url ');
      }

      const { SSEClientTransport } = await import(
        '@modelcontextprotocol/sdk/client/sse.js'
      );

      return new SSEClientTransport(new URL(url), {
        requestInit: { headers: headers || {} },
      });
    }

    if (type === 'http') {
      if (!url) {
        throw new Error('http  url ');
      }
      try {
        const { StreamableHTTPClientTransport } = await import(
          '@modelcontextprotocol/sdk/client/streamableHttp.js'
        );
        return new StreamableHTTPClientTransport(new URL(url), {
          requestInit: { headers: headers || {} },
        });
      } catch {
        const { SSEClientTransport } = await import(
          '@modelcontextprotocol/sdk/client/sse.js'
        );
        return new SSEClientTransport(new URL(url), {
          requestInit: { headers: headers || {} },
        });
      }
    }

    throw new Error(`: ${type}`);
  }

  /**
   * 
   */
  private async loadTools(): Promise<void> {
    if (!this.sdkClient) {
      throw new Error('');
    }

    try {
      const result = await this.sdkClient.listTools();
      const oldCount = this.tools.size;

      this.tools.clear();
      if (result.tools && Array.isArray(result.tools)) {
        for (const tool of result.tools) {
          this.tools.set(tool.name, {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema || { type: 'object' },
          });
        }
      }

      if (oldCount !== this.tools.size) {
        this.emit('toolsUpdated', this.availableTools);
      }
    } catch (error) {
      this.debug.error(`:`, error);
      throw error;
    }
  }

  /**
   * 
   */
  async reloadTools(): Promise<void> {
    await this.loadTools();
  }

  /**
   * 
   */
  async callTool(
    name: string,
    arguments_: Record<string, any> = {}
  ): Promise<McpToolCallResponse> {
    if (!this.sdkClient) {
      throw new Error('');
    }

    if (!this.tools.has(name)) {
      throw new Error(` "${name}" `);
    }

    try {
      const result = await this.sdkClient.callTool({
        name,
        arguments: arguments_,
      });

      return result as McpToolCallResponse;
    } catch (error) {
      this.debug.error(` "${name}" :`, error);
      throw error;
    }
  }

  /**
   * 
   */
  async disconnect(): Promise<void> {
    this.isManualDisconnect = true;
    if (this.healthMonitor) {
      this.healthMonitor.stop();
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sdkClient) {
      try {
        await this.sdkClient.close();
      } catch (error) {
        this.debug.warn(`:`, error);
      }
      this.sdkClient = null;
    }

    this.tools.clear();
    this.setStatus(McpConnectionStatus.DISCONNECTED);
    this.emit('disconnected');

    this.debug.log(``);
  }

  /**
   * 
   */
  private handleUnexpectedClose(): void {
    if (this.isManualDisconnect) {
      return;
    }

    if (this.status === McpConnectionStatus.CONNECTED) {
      this.debug.warn(`，...`);
      this.setStatus(McpConnectionStatus.ERROR);
      this.emit('error', new Error('MCP'));
      this.scheduleReconnect();
    }
  }

  /**
   * 
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.reconnectAttempts >= DEFAULT_CONNECTION_CONFIG.maxReconnectAttempts) {
      this.debug.error(`，`);
      this.emit('reconnectFailed');
      return;
    }
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      DEFAULT_CONNECTION_CONFIG.maxReconnectDelay
    );
    this.reconnectAttempts++;

    this.debug.log(
      ` ${delay}ms  ${this.reconnectAttempts} ...`
    );

    this.emit('reconnecting', this.reconnectAttempts);

    this.reconnectTimer = setTimeout(async () => {
      try {
        if (this.sdkClient) {
          await this.sdkClient.close().catch(() => {});
          this.sdkClient = null;
        }

        this.setStatus(McpConnectionStatus.DISCONNECTED);
        await this.doConnect();

        this.debug.log(``);
        this.reconnectAttempts = 0;
        this.emit('reconnected');
      } catch (error) {
        const classified = classifyError(error);
        if (classified.isRetryable) {
          this.scheduleReconnect();
        } else {
          this.debug.error(`，`);
          this.emit('reconnectFailed');
        }
      }
    }, delay);
  }
}
