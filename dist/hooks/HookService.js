/**
 * Hook Service - Hooks 系统的简洁 API 层
 *
 *
 *
 */
import { getHookManager } from './HookManager.js';
/**
 *
 */
function createContext(sessionId, projectDir, permissionMode) {
    return {
        sessionId,
        projectDir: projectDir || process.cwd(),
        permissionMode: (permissionMode || 'default'),
    };
}
/**
 *
 */
export function isHooksAvailable() {
    const manager = getHookManager();
    return manager.isInitialized() && manager.isEnabled();
}
// ==================== 生命周
/**
 *
 */
export async function onSessionStart(sessionId, projectDir) {
    if (!isHooksAvailable())
        return;
    try {
        await getHookManager().executeSessionStartHooks(createContext(sessionId, projectDir));
    }
    catch (error) {
        console.warn('[HookService] SessionStart hook error:', error);
    }
}
/**
 *
 */
export async function onSessionEnd(sessionId, projectDir) {
    if (!isHooksAvailable())
        return;
    try {
        await getHookManager().executeSessionEndHooks(createContext(sessionId, projectDir));
    }
    catch (error) {
        console.warn('[HookService] SessionEnd hook error:', error);
    }
}
/**
 *
 * @returns 注入的上下文（如果有）
 */
export async function onUserPromptSubmit(promptContent, sessionId, projectDir) {
    if (!isHooksAvailable())
        return undefined;
    try {
        const result = await getHookManager().executeUserPromptHooks(promptContent, createContext(sessionId, projectDir));
        return result.injectedContext;
    }
    catch (error) {
        console.warn('[HookService] UserPromptSubmit hook error:', error);
        return undefined;
    }
}
// ==================== 控制
/**
 * Agent 停止
 * @returns true 表示应该继续执行
 */
export async function onStop(stopReason, sessionId, projectDir) {
    if (!isHooksAvailable())
        return false;
    try {
        const result = await getHookManager().executeStopHooks(stopReason, createContext(sessionId, projectDir));
        return result.shouldContinue;
    }
    catch (error) {
        console.warn('[HookService] Stop hook error:', error);
        return false;
    }
}
/**
 *
 * @returns true 表示应该阻止压缩
 */
export async function onCompaction(preTokens, messageCount, sessionId, projectDir) {
    if (!isHooksAvailable())
        return false;
    try {
        const result = await getHookManager().executeCompactionHooks(preTokens, messageCount, createContext(sessionId, projectDir));
        return result.shouldPrevent;
    }
    catch (error) {
        console.warn('[HookService] Compaction hook error:', error);
        return false;
    }
}
/**
 *
 */
export async function onPreToolUse(toolName, toolUseId, toolInput, sessionId, projectDir, permissionMode) {
    if (!isHooksAvailable()) {
        return { decision: 'allow' };
    }
    try {
        return await getHookManager().executePreToolHooks(toolName, toolUseId, toolInput, createContext(sessionId, projectDir, permissionMode));
    }
    catch (error) {
        console.warn('[HookService] PreToolUse hook error:', error);
        return { decision: 'allow' };
    }
}
/**
 *
 */
export async function onPostToolUse(toolName, toolUseId, toolInput, toolResult, sessionId, projectDir, permissionMode) {
    if (!isHooksAvailable()) {
        return {};
    }
    try {
        return await getHookManager().executePostToolHooks(toolName, toolUseId, toolInput, toolResult, createContext(sessionId, projectDir, permissionMode));
    }
    catch (error) {
        console.warn('[HookService] PostToolUse hook error:', error);
        return {};
    }
}
/**
 *
 */
export async function onPostToolUseFailure(toolName, toolUseId, toolInput, errorMessage, sessionId, projectDir, permissionMode) {
    if (!isHooksAvailable())
        return;
    try {
        await getHookManager().executePostToolFailureHooks(toolName, toolUseId, toolInput, errorMessage, createContext(sessionId, projectDir, permissionMode));
    }
    catch (error) {
        console.warn('[HookService] PostToolUseFailure hook error:', error);
    }
}
/**
 *
 * @returns 'approve' | 'deny' | 'ask'
 */
export async function onPermissionRequest(toolName, toolInput, sessionId, projectDir, permissionMode) {
    if (!isHooksAvailable())
        return 'ask';
    try {
        const result = await getHookManager().executePermissionHooks(toolName, toolInput, createContext(sessionId, projectDir, permissionMode));
        return result.decision;
    }
    catch (error) {
        console.warn('[HookService] PermissionRequest hook error:', error);
        return 'ask';
    }
}
//# sourceMappingURL=HookService.js.map