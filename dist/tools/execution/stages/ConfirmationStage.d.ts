/**
 * Confirmation Stage - 用户确认阶段
 *
 */
import type { PipelineStage, ToolExecution } from '../types.js';
export declare class ConfirmationStage implements PipelineStage {
    private sessionApprovals;
    readonly name = "confirmation";
    constructor(sessionApprovals: Set<string>);
    process(execution: ToolExecution): Promise<void>;
    /**
     *
     */
    private generatePreview;
    /**
     *
     */
    private extractRisks;
    /**
     *
     */
    private getAffectedPaths;
    /**
     *
     */
    private truncate;
}
//# sourceMappingURL=ConfirmationStage.d.ts.map