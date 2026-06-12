/**
 * MCP 服务器健康监控
 *
 */
import { EventEmitter } from 'events';
import type { HealthCheckConfig, McpClientInterface } from './types.js';
/**
 *
 */
export declare class HealthMonitor extends EventEmitter {
    private client;
    private config;
    private checkTimer;
    private consecutiveFailures;
    private isRunning;
    private lastCheckTime;
    private lastCheckResult;
    private debug;
    constructor(client: McpClientInterface, config?: HealthCheckConfig);
    /**
     *
     */
    start(): void;
    /**
     *
     */
    stop(): void;
    /**
     *
     */
    getStatus(): {
        isHealthy: boolean;
        consecutiveFailures: number;
        lastCheckTime: Date | null;
        lastCheckResult: 'healthy' | 'unhealthy' | 'unknown';
    };
    /**
     *
     */
    private scheduleNextCheck;
    /**
     *
     */
    private performCheck;
    /**
     *
     *
     */
    private doHealthCheck;
}
//# sourceMappingURL=HealthMonitor.d.ts.map