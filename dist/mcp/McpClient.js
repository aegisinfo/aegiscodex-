/**
 * MCP 客户端
 *
 */
import { EventEmitter } from 'events';
import { McpConnectionStatus, ErrorType, DEFAULT_CONNECTION_CONFIG, } from './types.js';
import { HealthMonitor } from './HealthMonitor.js';
import { createDebugLogger } from '../utils/debug.js';
/**
 *
 */
function classifyError(error) {
    if (!(error instanceof Error)) {
        return {
            type: ErrorType.UNKNOWN,
            isRetryable: false,
            originalError: new Error(String(error)),
        };
    }
    const msg = error.message.toLowerCase();
    // 永久性配置错误（不重
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
    // 认证错误（需要用户介
    if (msg.includes('unauthorized') || msg.includes('401') || msg.includes('authentication failed')) {
        return { type: ErrorType.AUTH_ERROR, isRetryable: false, originalError: error };
    }
    // 临时网络错误（可重
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
    // 默认允许重
    return { type: ErrorType.UNKNOWN, isRetryable: true, originalError: error };
}
/**
 * MCP 客户端实现
 */
export class McpClient extends EventEmitter {
    config;
    status = McpConnectionStatus.DISCONNECTED;
    sdkClient = null; // @modelcontextprotocol/sdk Client
    tools = new Map();
    serverInfo = null;
    // 重连配
    reconnectAttempts = 0;
    reconnectTimer = null;
    isManualDisconnect = false;
    // 健康监
    healthMonitor = null;
    // 服务器名称（用于日
    serverName;
    // Debug logger
    debug;
    constructor(config, serverName, healthCheckConfig) {
        super();
        this.config = config;
        this.serverName = serverName || 'default';
        this.debug = createDebugLogger(`McpClient:${this.serverName}`);
        // 初始化健康监
        if (healthCheckConfig?.enabled) {
            this.healthMonitor = new HealthMonitor(this, healthCheckConfig);
            this.healthMonitor.on('unhealthy', (failures, error) => {
                this.emit('unhealthy', failures, error);
                // 触发重
                if (this.status === McpConnectionStatus.CONNECTED) {
                    this.handleUnexpectedClose();
                }
            });
        }
    }
    /**
     *
     */
    get connectionStatus() {
        return this.status;
    }
    /**
     *
     */
    get availableTools() {
        return Array.from(this.tools.values());
    }
    /**
     *
     */
    setStatus(status) {
        const oldStatus = this.status;
        this.status = status;
        if (oldStatus !== status) {
            this.emit('statusChanged', status, oldStatus);
        }
    }
    /**
     *
     */
    async connectWithRetry(maxRetries = DEFAULT_CONNECTION_CONFIG.maxRetries, initialDelay = DEFAULT_CONNECTION_CONFIG.initialDelay) {
        if (this.status !== McpConnectionStatus.DISCONNECTED) {
            throw new Error('客户端已连接或正在连接中');
        }
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.doConnect();
                this.reconnectAttempts = 0;
                return;
            }
            catch (error) {
                lastError = error;
                const classified = classifyError(error);
                this.debug.warn(`连接失败（${attempt}/${maxRetries}）:`, classified.type, error.message);
                // 永久性错误不重
                if (!classified.isRetryable) {
                    this.debug.error(`检测到永久性错误，放弃重试`);
                    throw error;
                }
                // 指数退避重
                if (attempt < maxRetries) {
                    const delay = initialDelay * Math.pow(2, attempt - 1);
                    this.debug.log(`${delay}ms 后重试...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw lastError || new Error('连接失败');
    }
    /**
     *
     */
    async doConnect() {
        try {
            this.setStatus(McpConnectionStatus.CONNECTING);
            // 动态导
            const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
            // 创建 SDK 客户
            this.sdkClient = new Client({ name: 'aegis', version: '1.0.0' }, { capabilities: { roots: { listChanged: true }, sampling: {} } });
            // 监听关闭事
            this.sdkClient.onclose = () => this.handleUnexpectedClose();
            // 创建传输
            const transport = await this.createTransport();
            // 连
            await this.sdkClient.connect(transport);
            // 获取服务器信
            const serverVersion = this.sdkClient.getServerVersion?.();
            this.serverInfo = {
                name: serverVersion?.name || 'Unknown',
                version: serverVersion?.version || '0.0.0',
            };
            // 加载工具列
            await this.loadTools();
            this.setStatus(McpConnectionStatus.CONNECTED);
            this.emit('connected', this.serverInfo);
            // 启动健康监
            if (this.healthMonitor) {
                this.healthMonitor.start();
            }
            this.debug.log(`已连接到服务器:`, this.serverInfo.name, `v${this.serverInfo.version}`, `(${this.tools.size} 个工具)`);
        }
        catch (error) {
            this.setStatus(McpConnectionStatus.ERROR);
            this.emit('error', error);
            throw error;
        }
    }
    /**
     *
     */
    async createTransport() {
        const { type, command, args, env, cwd, url, headers } = this.config;
        if (type === 'stdio') {
            if (!command) {
                throw new Error('stdio 传输需要 command 参数');
            }
            const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
            // Whitelist — skicka bara säkra env-variabler till MCP child processes
            const SAFE_ENV_KEYS = ['PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'LC_ALL', 'TERM', 'TZ'];
            const mergedEnv = {};
            for (const key of SAFE_ENV_KEYS) {
                const value = process.env[key];
                if (value !== undefined)
                    mergedEnv[key] = value;
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
                throw new Error('sse 传输需要 url 参数');
            }
            const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');
            return new SSEClientTransport(new URL(url), {
                requestInit: { headers: headers || {} },
            });
        }
        if (type === 'http') {
            if (!url) {
                throw new Error('http 传输需要 url 参数');
            }
            // HTTP Streamable 传输（如果 SDK 支
            try {
                const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
                return new StreamableHTTPClientTransport(new URL(url), {
                    requestInit: { headers: headers || {} },
                });
            }
            catch {
                // 回退
                const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');
                return new SSEClientTransport(new URL(url), {
                    requestInit: { headers: headers || {} },
                });
            }
        }
        throw new Error(`不支持的传输类型: ${type}`);
    }
    /**
     *
     */
    async loadTools() {
        if (!this.sdkClient) {
            throw new Error('客户端未连接');
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
        }
        catch (error) {
            this.debug.error(`加载工具列表失败:`, error);
            throw error;
        }
    }
    /**
     *
     */
    async reloadTools() {
        await this.loadTools();
    }
    /**
     *
     */
    async callTool(name, arguments_ = {}) {
        if (!this.sdkClient) {
            throw new Error('客户端未连接到服务器');
        }
        if (!this.tools.has(name)) {
            throw new Error(`工具 "${name}" 不存在`);
        }
        try {
            const result = await this.sdkClient.callTool({
                name,
                arguments: arguments_,
            });
            return result;
        }
        catch (error) {
            this.debug.error(`调用工具 "${name}" 失败:`, error);
            throw error;
        }
    }
    /**
     *
     */
    async disconnect() {
        this.isManualDisconnect = true;
        // 停止健康监
        if (this.healthMonitor) {
            this.healthMonitor.stop();
        }
        // 清除重连计时
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        // 关闭 SDK 客户
        if (this.sdkClient) {
            try {
                await this.sdkClient.close();
            }
            catch (error) {
                this.debug.warn(`关闭连接时出错:`, error);
            }
            this.sdkClient = null;
        }
        this.tools.clear();
        this.setStatus(McpConnectionStatus.DISCONNECTED);
        this.emit('disconnected');
        this.debug.log(`已断开连接`);
    }
    /**
     *
     */
    handleUnexpectedClose() {
        if (this.isManualDisconnect) {
            return;
        }
        if (this.status === McpConnectionStatus.CONNECTED) {
            this.debug.warn(`检测到意外断连，准备重连...`);
            this.setStatus(McpConnectionStatus.ERROR);
            this.emit('error', new Error('MCP服务器连接意外关闭'));
            this.scheduleReconnect();
        }
    }
    /**
     *
     */
    scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.reconnectAttempts >= DEFAULT_CONNECTION_CONFIG.maxReconnectAttempts) {
            this.debug.error(`达到最大重连次数，放弃重连`);
            this.emit('reconnectFailed');
            return;
        }
        // 指数退避：1s, 2s, 4s, 8s, 16s（最
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), DEFAULT_CONNECTION_CONFIG.maxReconnectDelay);
        this.reconnectAttempts++;
        this.debug.log(`将在 ${delay}ms 后进行第 ${this.reconnectAttempts} 次重连...`);
        this.emit('reconnecting', this.reconnectAttempts);
        this.reconnectTimer = setTimeout(async () => {
            try {
                // 清理旧连
                if (this.sdkClient) {
                    await this.sdkClient.close().catch(() => { });
                    this.sdkClient = null;
                }
                this.setStatus(McpConnectionStatus.DISCONNECTED);
                await this.doConnect();
                this.debug.log(`重连成功`);
                this.reconnectAttempts = 0;
                this.emit('reconnected');
            }
            catch (error) {
                const classified = classifyError(error);
                if (classified.isRetryable) {
                    this.scheduleReconnect();
                }
                else {
                    this.debug.error(`检测到永久性错误，停止重连`);
                    this.emit('reconnectFailed');
                }
            }
        }, delay);
    }
}
//# sourceMappingURL=McpClient.js.map