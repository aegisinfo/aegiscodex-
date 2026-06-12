/**
 * MCP 客户端
 *
 */
import { EventEmitter } from 'events';
import { McpConnectionStatus, McpToolDefinition, McpToolCallResponse, McpServerConfig, HealthCheckConfig, type McpClientInterface } from './types.js';
/**
 * MCP 客户端实现
 */
export declare class McpClient extends EventEmitter implements McpClientInterface {
    private config;
    private status;
    private sdkClient;
    private tools;
    private serverInfo;
    private reconnectAttempts;
    private reconnectTimer;
    private isManualDisconnect;
    private healthMonitor;
    readonly serverName: string;
    private debug;
    constructor(config: McpServerConfig, serverName?: string, healthCheckConfig?: HealthCheckConfig);
    /**
     *
     */
    get connectionStatus(): McpConnectionStatus;
    /**
     *
     */
    get availableTools(): McpToolDefinition[];
    /**
     *
     */
    private setStatus;
    /**
     *
     */
    connectWithRetry(maxRetries?: number, initialDelay?: number): Promise<void>;
    /**
     *
     */
    private doConnect;
    /**
     *
     */
    private createTransport;
    /**
     *
     */
    private loadTools;
    /**
     *
     */
    reloadTools(): Promise<void>;
    /**
     *
     */
    callTool(name: string, arguments_?: Record<string, any>): Promise<McpToolCallResponse>;
    /**
     *
     */
    disconnect(): Promise<void>;
    /**
     *
     */
    private handleUnexpectedClose;
    /**
     *
     */
    private scheduleReconnect;
}
//# sourceMappingURL=McpClient.d.ts.map