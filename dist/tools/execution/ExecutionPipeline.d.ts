/**
 * ExecutionPipeline - 执行管道
 *
 */
import { ToolExecution, type PipelineExecutionContext, type ExecutionPipelineConfig, type ExecutionHistoryEntry, type StageStartEvent, type StageCompleteEvent } from './types.js';
import type { ToolResult } from '../types.js';
import type { ToolRegistry } from '../registry.js';
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
export declare class ExecutionPipeline {
    private registry;
    private stages;
    private executionHistory;
    private readonly sessionApprovals;
    private readonly maxHistorySize;
    constructor(registry: ToolRegistry, config?: ExecutionPipelineConfig);
    /**
     *
     */
    execute(toolName: string, params: Record<string, unknown>, context: PipelineExecutionContext): Promise<ToolResult>;
    /**
     *
     */
    private createErrorResult;
    /**
     *
     */
    private recordExecution;
    /**
     *
     */
    getRegistry(): ToolRegistry;
    /**
     *
     */
    getHistory(): ExecutionHistoryEntry[];
    /**
     *
     */
    clearHistory(): void;
    /**
     *
     */
    getSessionApprovals(): Set<string>;
    /**
     *
     */
    clearSessionApprovals(): void;
    /**
     *
     */
    addSessionApproval(signature: string): void;
    /**
     *
     */
    hasSessionApproval(signature: string): boolean;
    /**
     *
     */
    getStageNames(): string[];
}
//# sourceMappingURL=ExecutionPipeline.d.ts.map