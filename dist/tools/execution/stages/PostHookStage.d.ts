/**
 * Post Hook Stage - PostToolUse Hooks 执行阶段
 *
 */
import type { PipelineStage, ToolExecution } from '../types.js';
export declare class PostHookStage implements PipelineStage {
    readonly name = "postHook";
    process(execution: ToolExecution): Promise<void>;
}
//# sourceMappingURL=PostHookStage.d.ts.map