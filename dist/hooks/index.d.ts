/**
 * Hooks 系统模块
 *
 *
 */
export * from './types.js';
export { HookManager, getHookManager } from './HookManager.js';
export { HookExecutor } from './HookExecutor.js';
export { Matcher, extractFilePath, extractCommand } from './Matcher.js';
export { isHooksAvailable, onSessionStart, onSessionEnd, onUserPromptSubmit, onStop, onCompaction, onPreToolUse, onPostToolUse, onPostToolUseFailure, onPermissionRequest, type PreToolHookResult, type PostToolHookResult, } from './HookService.js';
import type { HookConfig } from './types.js';
/**
 *
 */
export declare function initializeHooks(config: Partial<HookConfig>): void;
/**
 *
 */
export declare function isHooksEnabled(): boolean;
/**
 *
 */
export declare function getHookStats(): {
    enabled: boolean;
    counts: Record<string, number>;
};
//# sourceMappingURL=index.d.ts.map