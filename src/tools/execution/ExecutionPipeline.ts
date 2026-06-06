/**
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
  private executionHistory: ExecutionHistoryEntry[] = [];
  private readonly sessionApprovals = new Set<string>();
  private readonly maxHistorySize = 1000;

  constructor(
    private registry: ToolRegistry,
    config: ExecutionPipelineConfig = {}
  ) {

    const defaultMode = config.defaultMode || PermissionMode.DEFAULT;
    this.stages = [
      new DiscoveryStage(this.registry),
      new PermissionStage(config.permissions, this.sessionApprovals, defaultMode),
      new HookStage(),
      new ConfirmationStage(this.sessionApprovals),
      new ExecutionStage(),
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
    const execution = new ToolExecution(toolName, params, context);

    try {
      for (const stage of this.stages) {
        if (execution.isAborted()) {
          break;
        }
        await stage.process(execution);
        executedStages.push(stage.name);
      }
      const result = execution.getResult() || this.createErrorResult(execution);
      this.recordExecution({
        toolName,
        params,
        result,
        timestamp: startTime,
        duration: Date.now() - startTime,
        permissionMode: context.permissionMode,
        stages: executedStages,
      });

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
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

  /**
   * 
   */
  getStageNames(): string[] {
    return this.stages.map(s => s.name);
  }
}
