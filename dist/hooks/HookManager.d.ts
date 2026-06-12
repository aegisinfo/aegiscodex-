/**
 * Hook 管理器
 *
 *
 * - 加载和管理 Hook 配置
 * - 协调 Hook 的匹配和执行
 * - 防止重复执行
 */
import { HookEvent, type HookConfig, type HookContext, type PreToolHookResult, type PostToolHookResult, type PermissionHookResult, type StopHookResult, type UserPromptHookResult, type CompactionHookResult } from './types.js';
/**
 * Hook 管理器
 */
export declare class HookManager {
    private static instance;
    private config;
    private executor;
    private matcher;
    private guard;
    private sessionDisabled;
    private initialized;
    private constructor();
    /**
     *
     */
    static getInstance(): HookManager;
    /**
     *
     */
    static resetInstance(): void;
    /**
     *
     */
    loadConfig(config: Partial<HookConfig>): void;
    /**
     *
     */
    private mergeConfig;
    /**
     *
     */
    isEnabled(): boolean;
    /**
     *
     */
    disableForSession(): void;
    /**
     *
     */
    enableForSession(): void;
    /**
     *
     */
    getConfig(): HookConfig;
    /**
     *
     */
    isInitialized(): boolean;
    /**
     *
     */
    private getMatchingHooks;
    /**
     *
     */
    private createExecutionContext;
    /**
     *
     */
    executePreToolHooks(toolName: string, toolUseId: string, toolInput: Record<string, unknown>, context: HookContext): Promise<PreToolHookResult>;
    /**
     *
     */
    executePostToolHooks(toolName: string, toolUseId: string, toolInput: Record<string, unknown>, toolOutput: unknown, context: HookContext): Promise<PostToolHookResult>;
    /**
     *
     */
    executePostToolFailureHooks(toolName: string, toolUseId: string, toolInput: Record<string, unknown>, error: string, context: HookContext): Promise<void>;
    /**
     *
     */
    executePermissionHooks(toolName: string, toolInput: Record<string, unknown>, context: HookContext): Promise<PermissionHookResult>;
    /**
     *
     */
    executeUserPromptHooks(promptContent: string, context: HookContext): Promise<UserPromptHookResult>;
    /**
     *
     */
    executeSessionStartHooks(context: HookContext): Promise<void>;
    /**
     *
     */
    executeSessionEndHooks(context: HookContext): Promise<void>;
    /**
     *
     */
    executeStopHooks(stopReason: string | undefined, context: HookContext): Promise<StopHookResult>;
    /**
     *
     */
    executeCompactionHooks(preTokens: number, messageCount: number, context: HookContext): Promise<CompactionHookResult>;
    /**
     *
     */
    getHookCounts(): Record<string, number>;
    /**
     *
     */
    getConfiguredEvents(): HookEvent[];
}
/**
 *
 */
export declare function getHookManager(): HookManager;
//# sourceMappingURL=HookManager.d.ts.map