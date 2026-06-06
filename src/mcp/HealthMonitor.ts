/**
 * 
 */

import { EventEmitter } from 'events';
import type { HealthCheckConfig, McpClientInterface } from './types.js';
import { McpConnectionStatus, DEFAULT_HEALTH_CHECK_CONFIG } from './types.js';
import { createDebugLogger } from '../utils/debug.js';

/**
 * 
 */
export class HealthMonitor extends EventEmitter {
  private checkTimer: NodeJS.Timeout | null = null;
  private consecutiveFailures = 0;
  private isRunning = false;
  private lastCheckTime: Date | null = null;
  private lastCheckResult: 'healthy' | 'unhealthy' | 'unknown' = 'unknown';
  private debug: ReturnType<typeof createDebugLogger>;

  constructor(
    private client: McpClientInterface,
    private config: HealthCheckConfig = DEFAULT_HEALTH_CHECK_CONFIG
  ) {
    super();
    this.debug = createDebugLogger(`HealthMonitor:${client.serverName}`);
  }

  /**
   * 
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.consecutiveFailures = 0;
    this.scheduleNextCheck();

    this.debug.log(
      ``,
      `(: ${this.config.intervalMs}ms, : ${this.config.timeoutMs}ms)`
    );
  }

  /**
   * 
   */
  stop(): void {
    this.isRunning = false;
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }
    this.debug.log(``);
  }

  /**
   * 
   */
  getStatus(): {
    isHealthy: boolean;
    consecutiveFailures: number;
    lastCheckTime: Date | null;
    lastCheckResult: 'healthy' | 'unhealthy' | 'unknown';
  } {
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
  private scheduleNextCheck(): void {
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
  private async performCheck(): Promise<void> {
    if (!this.isRunning) {
      return;
    }
    if (this.client.connectionStatus !== McpConnectionStatus.CONNECTED) {
      this.lastCheckResult = 'unknown';
      return;
    }

    this.lastCheckTime = new Date();

    try {
      const checkPromise = this.doHealthCheck();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('')), this.config.timeoutMs);
      });

      await Promise.race([checkPromise, timeoutPromise]);
      this.consecutiveFailures = 0;
      this.lastCheckResult = 'healthy';
      this.emit('healthy');
    } catch (error) {
      this.consecutiveFailures++;
      this.lastCheckResult = 'unhealthy';

      this.debug.warn(
        ``,
        `(${this.consecutiveFailures}/${this.config.maxFailures}):`,
        (error as Error).message
      );
      if (this.consecutiveFailures >= this.config.maxFailures) {
        this.debug.error(
          `， ${this.consecutiveFailures} `
        );
        this.emit('unhealthy', this.consecutiveFailures, error);
      }
    }
  }

  /**
   * 
   * 
   */
  private async doHealthCheck(): Promise<void> {
    await this.client.reloadTools();
  }
}
