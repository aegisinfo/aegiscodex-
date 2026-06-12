/**
 * Execution Stage - 实际执行阶段
 *
 */
import type { PipelineStage, ToolExecution } from '../types.js';
export declare class ExecutionStage implements PipelineStage {
    readonly name = "execution";
    process(execution: ToolExecution): Promise<void>;
}
//# sourceMappingURL=ExecutionStage.d.ts.map