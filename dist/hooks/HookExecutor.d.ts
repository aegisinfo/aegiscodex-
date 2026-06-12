/**
 * Hook 执行器
 *
 *
 */
import type { Hook, HookInput, HookExecutionContext, PreToolHookResult, PostToolHookResult, PermissionHookResult, StopHookResult, UserPromptHookResult, CompactionHookResult } from './types.js';
/**
 * Hook 执行器
 */
export declare class HookExecutor {
    /**
     *
     *
     *
     * 1. 第一个 deny 需要立即中断
     * 2. updatedInput 需要累积应用
     */
    executePreToolHooks(hooks: Hook[], input: HookInput, context: HookExecutionContext): Promise<PreToolHookResult>;
    /**
     *
     *
     *
     */
    executePostToolHooks(hooks: Hook[], input: HookInput, context: HookExecutionContext): Promise<PostToolHookResult>;
    /**
     *
     *
     *
     */
    executePermissionHooks(hooks: Hook[], input: HookInput, context: HookExecutionContext): Promise<PermissionHookResult>;
    /**
     *
     *
     *
     */
    executeStopHooks(hooks: Hook[], input: HookInput, context: HookExecutionContext): Promise<StopHookResult>;
    /**
     *
     *
     * stdout 合并注入
     */
    executeUserPromptHooks(hooks: Hook[], input: HookInput, context: HookExecutionContext): Promise<UserPromptHookResult>;
    /**
     *
     */
    executeCompactionHooks(hooks: Hook[], input: HookInput, context: HookExecutionContext): Promise<CompactionHookResult>;
    /**
     *
     */
    executeGenericHooks(hooks: Hook[], input: HookInput, context: HookExecutionContext): Promise<void>;
    /**
     *
     */
    private executeHooksConcurrently;
    /**
     *
     */
    private executeHook;
    /**
     *
     */
    private executeCommandHook;
    /**
     *
     */
    private handleTimeout;
    /**
     *
     */
    private parseResult;
}
//# sourceMappingURL=HookExecutor.d.ts.map