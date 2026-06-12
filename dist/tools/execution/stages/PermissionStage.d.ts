/**
 * Permission Stage - 权限检查阶段
 *
 */
import { PermissionMode, type PipelineStage, type ToolExecution, type PermissionConfig } from '../types.js';
export declare class PermissionStage implements PipelineStage {
    private sessionApprovals?;
    readonly name = "permission";
    private permissionChecker;
    private defaultMode;
    constructor(config?: Partial<PermissionConfig>, sessionApprovals?: Set<string> | undefined, defaultMode?: PermissionMode);
    process(execution: ToolExecution): Promise<void>;
    /**
     *
     */
    private applyModeOverrides;
    /**
     *
     */
    private checkSensitiveFiles;
    /**
     *
     */
    private getAffectedPaths;
    /**
     *
     */
    private executePermissionHook;
}
//# sourceMappingURL=PermissionStage.d.ts.map