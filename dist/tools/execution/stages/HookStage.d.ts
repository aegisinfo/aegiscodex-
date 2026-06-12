/**
 * Hook Stage (Pre) - PreToolUse Hooks 执行阶段
 *
 */
import type { PipelineStage, ToolExecution } from '../types.js';
export declare class HookStage implements PipelineStage {
    readonly name = "hook";
    process(execution: ToolExecution): Promise<void>;
}
//# sourceMappingURL=HookStage.d.ts.map