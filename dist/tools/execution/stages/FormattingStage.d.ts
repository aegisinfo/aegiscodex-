/**
 * Formatting Stage - 结果格式化阶段
 *
 */
import type { PipelineStage, ToolExecution } from '../types.js';
export declare class FormattingStage implements PipelineStage {
    readonly name = "formatting";
    process(execution: ToolExecution): Promise<void>;
}
//# sourceMappingURL=FormattingStage.d.ts.map