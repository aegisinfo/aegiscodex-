/**
 * MCP 服务器注册中心
 * 
 */

import { EventEmitter } from 'events';
import {
  McpConnectionStatus,
  McpServerConfig,
  McpServerInfo,
  McpToolDefinition,
  McpRegistryStatistics,
} from './types.js';
import { McpClient } from './McpClient.js';
import { createMcpTool } from './createMcpTool.js';
import type { Tool } from '../tools/types.js';
import { mcpRegistryDebug } from '../utils/debug.js';

/**
 * MCP 注册中心（单例）
 */
export class McpRegistry extends EventEmitter {
  private static instance: McpRegistry | null = null;
  private servers: Map<string, McpServerInfo> = new Map();

  private constructor() {
    super();
    // 增加监听器上限，因为可能有多个 Agent 实例监听同一事
    this.setMaxListeners(20);
  }

  /**
   * 
   */
  static getInstance(): McpRegistry {
    if (!McpRegistry.instance) {
      McpRegistry.instance = new McpRegistry();
    }
    return McpRegistry.instance;
  }

  /**
   * 
   */
  static resetInstance(): void {
    if (McpRegistry.instance) {
      McpRegistry.instance.disconnectAll().catch(() => {});
      McpRegistry.instance = null;
    }
  }

  /**
   * 
   */
  async registerServer(name: string, config: McpServerConfig): Promise<void> {
    // 检查是否已禁
    if (config.enabled === false) {
      mcpRegistryDebug.log(`服务器 "${name}" 已禁用，跳过注册`);
      return;
    }

    if (this.servers.has(name)) {
      throw new Error(`MCP服务器 "${name}" 已经注册`);
    }

    const client = new McpClient(config, name, config.healthCheck);
    const serverInfo: McpServerInfo = {
      config,
      client,
      status: McpConnectionStatus.DISCONNECTED,
      tools: [],
    };

    // 设置事件处理
    this.setupClientEventHandlers(client, serverInfo, name);

    this.servers.set(name, serverInfo);
    this.emit('serverRegistered', name, serverInfo);

    mcpRegistryDebug.log(`已注册服务器: ${name} (${config.type})`);

    // 尝试连
    try {
      await this.connectServer(name);
    } catch (error) {
      mcpRegistryDebug.warn(`服务器 "${name}" 连接失败:`, (error as Error).message);
    }
  }

  /**
   * 
   */
  async registerServers(servers: Record<string, McpServerConfig>): Promise<void> {
    const promises = Object.entries(servers).map(([name, config]) =>
      this.registerServer(name, config).catch(error => {
        mcpRegistryDebug.warn(`注册服务器 "${name}" 失败:`, (error as Error).message);
        return error;
      })
    );

    await Promise.allSettled(promises);
  }

  /**
   * 
   */
  async connectServer(name: string): Promise<void> {
    const serverInfo = this.servers.get(name);
    if (!serverInfo) {
      throw new Error(`服务器 "${name}" 未注册`);
    }

    if (serverInfo.status === McpConnectionStatus.CONNECTED) {
      mcpRegistryDebug.log(`服务器 "${name}" 已连接`);
      return;
    }

    await serverInfo.client.connectWithRetry();
  }

  /**
   * 
   */
  async disconnectServer(name: string): Promise<void> {
    const serverInfo = this.servers.get(name);
    if (!serverInfo) {
      throw new Error(`服务器 "${name}" 未注册`);
    }

    await serverInfo.client.disconnect();
  }

  /**
   * 
   */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.servers.keys()).map(name =>
      this.disconnectServer(name).catch(() => {})
    );
    await Promise.allSettled(promises);
  }

  /**
   * 
   */
  async removeServer(name: string): Promise<void> {
    const serverInfo = this.servers.get(name);
    if (!serverInfo) {
      return;
    }

    await serverInfo.client.disconnect().catch(() => {});
    this.servers.delete(name);

    mcpRegistryDebug.log(`已移除服务器: ${name}`);
  }

  /**
   * 
   */
  private setupClientEventHandlers(
    client: McpClient,
    serverInfo: McpServerInfo,
    name: string
  ): void {
    client.on('connected', (server: { name: string; version: string }) => {
      serverInfo.status = McpConnectionStatus.CONNECTED;
      serverInfo.connectedAt = new Date();
      serverInfo.serverName = server.name;
      serverInfo.serverVersion = server.version;
      serverInfo.tools = client.availableTools;
      serverInfo.lastError = undefined;
      this.emit('serverConnected', name, server);
    });

    client.on('disconnected', () => {
      serverInfo.status = McpConnectionStatus.DISCONNECTED;
      serverInfo.connectedAt = undefined;
      serverInfo.tools = [];
      this.emit('serverDisconnected', name);
    });

    client.on('error', (error: Error) => {
      serverInfo.status = McpConnectionStatus.ERROR;
      serverInfo.lastError = error;
      this.emit('serverError', name, error);
    });

    client.on('toolsUpdated', (tools: McpToolDefinition[]) => {
      const oldCount = serverInfo.tools.length;
      serverInfo.tools = tools;
      this.emit('toolsUpdated', name, tools, oldCount);
    });

    client.on('reconnecting', (attempt: number) => {
      serverInfo.status = McpConnectionStatus.CONNECTING;
      mcpRegistryDebug.log(`服务器 "${name}" 正在重连 (第 ${attempt} 次)`);
    });

    client.on('reconnected', () => {
      mcpRegistryDebug.log(`服务器 "${name}" 重连成功`);
    });

    client.on('reconnectFailed', () => {
      serverInfo.status = McpConnectionStatus.ERROR;
      mcpRegistryDebug.error(`服务器 "${name}" 重连失败`);
    });
  }

  /**
   * 
   *
   * 
   * - 无冲突: toolName
   * - 有冲突: serverName__toolName
   */
  async getAvailableTools(): Promise<Tool[]> {
    const tools: Tool[] = [];
    const nameConflicts = new Map<string, number>();

    // 第一遍：检测冲
    for (const [, serverInfo] of this.servers) {
      if (serverInfo.status === McpConnectionStatus.CONNECTED) {
        for (const mcpTool of serverInfo.tools) {
          const count = nameConflicts.get(mcpTool.name) || 0;
          nameConflicts.set(mcpTool.name, count + 1);
        }
      }
    }

    // 第二遍：创建工具（冲突时添加前
    for (const [serverName, serverInfo] of this.servers) {
      if (serverInfo.status === McpConnectionStatus.CONNECTED) {
        for (const mcpTool of serverInfo.tools) {
          const hasConflict = (nameConflicts.get(mcpTool.name) || 0) > 1;
          const toolName = hasConflict
            ? `${serverName}__${mcpTool.name}`  // 冲突
            : mcpTool.name;                     // 无冲

          try {
            const tool = createMcpTool(
              serverInfo.client,
              serverName,
              mcpTool,
              toolName
            );
            tools.push(tool);
          } catch (error) {
            mcpRegistryDebug.warn(
              `创建工具 "${mcpTool.name}" 失败:`,
              (error as Error).message
            );
          }
        }
      }
    }

    return tools;
  }

  /**
   * 
   */
  getServer(name: string): McpServerInfo | undefined {
    return this.servers.get(name);
  }

  /**
   * 
   */
  getAllServers(): Map<string, McpServerInfo> {
    return new Map(this.servers);
  }

  /**
   * 
   */
  getStatistics(): McpRegistryStatistics {
    let connectedServers = 0;
    let disconnectedServers = 0;
    let errorServers = 0;
    let totalTools = 0;

    for (const serverInfo of this.servers.values()) {
      switch (serverInfo.status) {
        case McpConnectionStatus.CONNECTED:
          connectedServers++;
          totalTools += serverInfo.tools.length;
          break;
        case McpConnectionStatus.DISCONNECTED:
          disconnectedServers++;
          break;
        case McpConnectionStatus.ERROR:
          errorServers++;
          break;
      }
    }

    return {
      totalServers: this.servers.size,
      connectedServers,
      disconnectedServers,
      errorServers,
      totalTools,
    };
  }

  /**
   * 
   */
  hasServer(name: string): boolean {
    return this.servers.has(name);
  }

  /**
   * 
   */
  getServerStatus(name: string): McpConnectionStatus | undefined {
    return this.servers.get(name)?.status;
  }
}
