/**
 * ExecutionPipeline - 执行管道
 * 
 */

import {
  ToolExecution,
  PermissionMode,
  type PipelineStage,
  type PipelineExecutionContext,
  type ExecutionPipelineConfig,
  type ExecutionHistoryEntry,
  type StageStartEvent,
  type StageCompleteEvent,
} from './types.js';
import type { ToolResult, ToolErrorType } from '../types.js';
import type { ToolRegistry } from '../registry.js';
import {
  DiscoveryStage,
  CacheStage,
  PermissionStage,
  HookStage,
  ConfirmationStage,
  ExecutionStage,
  PostHookStage,
  FormattingStage,
} from './stages/index.js';

/**
 * 
 */
export interface ExecutionPipelineEvents {
  stageStart: (event: StageStartEvent) => void;
  stageComplete: (event: StageCompleteEvent) => void;
  executionStart: (execution: ToolExecution) => void;
  executionComplete: (execution: ToolExecution, result: ToolResult) => void;
  executionError: (execution: ToolExecution, error: Error) => void;
}

/**
 * 
 */
export class ExecutionPipeline {
  private stages: PipelineStage[];
  private cacheStage: CacheStage;
  private executionHistory: ExecutionHistoryEntry[] = [];
  private readonly sessionApprovals = new Set<string>();
  private readonly sessionDenials = new Set<string>();
  private readonly maxHistorySize = 1000;

  constructor(
    private registry: ToolRegistry,
    config: ExecutionPipelineConfig = {}
  ) {

    const defaultMode = config.defaultMode || PermissionMode.DEFAULT;
    this.cacheStage = new CacheStage();

    // 初始化八个执行阶
    this.stages = [
      new DiscoveryStage(this.registry, config.allowedTools, config.disallowedTools),
      this.cacheStage,
      new PermissionStage(config.permissions, this.sessionApprovals, this.sessionDenials, defaultMode),
      new HookStage(),
      new ConfirmationStage(this.sessionApprovals, this.sessionDenials),
      new ExecutionStage(this.cacheStage),
      new PostHookStage(),
      new FormattingStage(),
    ];
  }

  /**
   * 
   */
  async execute(
    toolName: string,
    params: Record<string, unknown>,
    context: PipelineExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const executedStages: string[] = [];

    // 创建执行实
    const execution = new ToolExecution(toolName, params, context);

    // 发出执行开始事

    try {
      // 依次执行各阶
      for (const stage of this.stages) {
        if (execution.isAborted()) {
          break;
        }

        // 发出阶段开始事

        // 执行阶
        await stage.process(execution);

        // 记录已执行的阶
        executedStages.push(stage.name);

        // 发出阶段完成事
      }

      // 获取或创建结
      const result = execution.getResult() || this.createErrorResult(execution);

      // 记录执行历
      this.recordExecution({
        toolName,
        params,
        result,
        timestamp: startTime,
        duration: Date.now() - startTime,
        permissionMode: context.permissionMode,
        stages: executedStages,
      });

      // 发出执行完成事

      return result;
    } catch (error) {
      // 发出执行错误事
      const err = error instanceof Error ? error : new Error(String(error));

      // 返回错误结
      return {
        success: false,
        llmContent: `Pipeline execution error: ${err.message}`,
        displayContent: `❌ Pipeline error: ${err.message}`,
        error: {
          type: 'execution_error' as ToolErrorType,
          message: err.message,
        },
      };
    }
  }

  /**
   * 
   */
  private createErrorResult(execution: ToolExecution): ToolResult {
    const reason = execution.getAbortReason() || 'Unknown error';
    return {
      success: false,
      llmContent: `Tool execution aborted: ${reason}`,
      displayContent: `❌ ${execution.toolName}: ${reason}`,
      error: {
        type: 'execution_error' as ToolErrorType,
        message: reason,
      },
    };
  }

  /**
   * 
   */
  private recordExecution(entry: ExecutionHistoryEntry): void {
    this.executionHistory.push(entry);

    // 限制历史大
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.shift();
    }
  }

  /**
   * 
   */
  getRegistry(): ToolRegistry {
    return this.registry;
  }

  /**
   * 
   */
  getHistory(): ExecutionHistoryEntry[] {
    return [...this.executionHistory];
  }

  /**
   * 
   */
  clearHistory(): void {
    this.executionHistory = [];
  }

  /**
   * 
   */
  getSessionApprovals(): Set<string> {
    return new Set(this.sessionApprovals);
  }

  /**
   * 
   */
  clearSessionApprovals(): void {
    this.sessionApprovals.clear();
  }

  /**
   * 
   */
  addSessionApproval(signature: string): void {
    this.sessionApprovals.add(signature);
  }

  /**
   * 
   */
  hasSessionApproval(signature: string): boolean {
    return this.sessionApprovals.has(signature);
  }

  // ==================== Session Denials ====================

  /**
   * 
   */
  getSessionDenials(): Set<string> {
    return new Set(this.sessionDenials);
  }

  /**
   * 
   */
  clearSessionDenials(): void {
    this.sessionDenials.clear();
  }

  /**
   * 
   */
  addSessionDenial(signature: string): void {
    this.sessionDenials.add(signature);
  }

  /**
   * 
   */
  hasSessionDenial(signature: string): boolean {
    return this.sessionDenials.has(signature);
  }

  /**
   * 
   */
  getStageNames(): string[] {
    return this.stages.map(s => s.name);
  }

  /** Stats for the session-scoped Read/Grep/Glob result cache */
  getCacheStats(): { size: number; maxSize: number } {
    return this.cacheStage.stats();
  }

  /** Clear cached entries for a specific session */
  clearSessionCache(sessionId: string): void {
    this.cacheStage.clearSession(sessionId);
  }
}
