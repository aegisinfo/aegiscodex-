/**
 * MCP 服务器健康监控
 *
 */
import { EventEmitter } from 'events';
import { McpConnectionStatus, DEFAULT_HEALTH_CHECK_CONFIG } from './types.js';
import { createDebugLogger } from '../utils/debug.js';
/**
 *
 */
export class HealthMonitor extends EventEmitter {
    client;
    config;
    checkTimer = null;
    consecutiveFailures = 0;
    isRunning = false;
    lastCheckTime = null;
    lastCheckResult = 'unknown';
    debug;
    constructor(client, config = DEFAULT_HEALTH_CHECK_CONFIG) {
        super();
        this.client = client;
        this.config = config;
        this.debug = createDebugLogger(`HealthMonitor:${client.serverName}`);
    }
    /**
     *
     */
    start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        this.consecutiveFailures = 0;
        this.scheduleNextCheck();
        this.debug.log(`健康监控已启动`, `(间隔: ${this.config.intervalMs}ms, 超时: ${this.config.timeoutMs}ms)`);
    }
    /**
     *
     */
    stop() {
        this.isRunning = false;
        if (this.checkTimer) {
            clearTimeout(this.checkTimer);
            this.checkTimer = null;
        }
        this.debug.log(`健康监控已停止`);
    }
    /**
     *
     */
    getStatus() {
        return {
            isHealthy: this.consecutiveFailures < this.config.maxFailures,
            consecutiveFailures: this.consecutiveFailures,
            lastCheckTime: this.lastCheckTime,
            lastCheckResult: this.lastCheckResult,
        };
    }
    /**
     *
     */
    scheduleNextCheck() {
        if (!this.isRunning) {
            return;
        }
        this.checkTimer = setTimeout(async () => {
            await this.performCheck();
            this.scheduleNextCheck();
        }, this.config.intervalMs);
    }
    /**
     *
     */
    async performCheck() {
        if (!this.isRunning) {
            return;
        }
        // 只在连接状态下进行检
        if (this.client.connectionStatus !== McpConnectionStatus.CONNECTED) {
            this.lastCheckResult = 'unknown';
            return;
        }
        this.lastCheckTime = new Date();
        try {
            // 使用超时包装检
            const checkPromise = this.doHealthCheck();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('健康检查超时')), this.config.timeoutMs);
            });
            await Promise.race([checkPromise, timeoutPromise]);
            // 检查成
            this.consecutiveFailures = 0;
            this.lastCheckResult = 'healthy';
            this.emit('healthy');
        }
        catch (error) {
            // 检查失
            this.consecutiveFailures++;
            this.lastCheckResult = 'unhealthy';
            this.debug.warn(`健康检查失败`, `(${this.consecutiveFailures}/${this.config.maxFailures}):`, error.message);
            // 超过最大失败次数，触发不健康事
            if (this.consecutiveFailures >= this.config.maxFailures) {
                this.debug.error(`服务器不健康，连续失败 ${this.consecutiveFailures} 次`);
                this.emit('unhealthy', this.consecutiveFailures, error);
            }
        }
    }
    /**
     *
     *
     */
    async doHealthCheck() {
        // 简单的健康检查：尝试重新加载工具列
        // 如果能成功获取，说明连接是健康
        await this.client.reloadTools();
    }
}
//# sourceMappingURL=HealthMonitor.js.map