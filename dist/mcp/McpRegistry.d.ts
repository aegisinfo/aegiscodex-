/**
 * MCP 服务器注册中心
 *
 */
import { EventEmitter } from 'events';
import { McpConnectionStatus, McpServerConfig, McpServerInfo, McpRegistryStatistics } from './types.js';
import type { Tool } from '../tools/types.js';
/**
 * MCP 注册中心（单例）
 */
export declare class McpRegistry extends EventEmitter {
    private static instance;
    private servers;
    private constructor();
    /**
     *
     */
    static getInstance(): McpRegistry;
    /**
     *
     */
    static resetInstance(): void;
    /**
     *
     */
    registerServer(name: string, config: McpServerConfig): Promise<void>;
    /**
     *
     */
    registerServers(servers: Record<string, McpServerConfig>): Promise<void>;
    /**
     *
     */
    connectServer(name: string): Promise<void>;
    /**
     *
     */
    disconnectServer(name: string): Promise<void>;
    /**
     *
     */
    disconnectAll(): Promise<void>;
    /**
     *
     */
    removeServer(name: string): Promise<void>;
    /**
     *
     */
    private setupClientEventHandlers;
    /**
     *
     *
     *
     * - 无冲突: toolName
     * - 有冲突: serverName__toolName
     */
    getAvailableTools(): Promise<Tool[]>;
    /**
     *
     */
    getServer(name: string): McpServerInfo | undefined;
    /**
     *
     */
    getAllServers(): Map<string, McpServerInfo>;
    /**
     *
     */
    getStatistics(): McpRegistryStatistics;
    /**
     *
     */
    hasServer(name: string): boolean;
    /**
     *
     */
    getServerStatus(name: string): McpConnectionStatus | undefined;
}
//# sourceMappingURL=McpRegistry.d.ts.map