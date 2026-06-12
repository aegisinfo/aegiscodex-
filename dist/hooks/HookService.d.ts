/**
 * Hook Service - Hooks 系统的简洁 API 层
 *
 *
 *
 */
/**
 *
 */
export declare function isHooksAvailable(): boolean;
/**
 *
 */
export declare function onSessionStart(sessionId: string, projectDir?: string): Promise<void>;
/**
 *
 */
export declare function onSessionEnd(sessionId: string, projectDir?: string): Promise<void>;
/**
 *
 * @returns 注入的上下文（如果有）
 */
export declare function onUserPromptSubmit(promptContent: string, sessionId: string, projectDir?: string): Promise<string | undefined>;
/**
 * Agent 停止
 * @returns true 表示应该继续执行
 */
export declare function onStop(stopReason: string | undefined, sessionId: string, projectDir?: string): Promise<boolean>;
/**
 *
 * @returns true 表示应该阻止压缩
 */
export declare function onCompaction(preTokens: number, messageCount: number, sessionId: string, projectDir?: string): Promise<boolean>;
/**
 * PreToolUse Hook 结果
 */
export interface PreToolHookResult {
    decision: 'allow' | 'deny' | 'ask';
    reason?: string;
    modifiedInput?: Record<string, unknown>;
    warning?: string;
}
/**
 * PostToolUse Hook 结果
 */
export interface PostToolHookResult {
    additionalContext?: string;
    modifiedOutput?: unknown;
}
/**
 *
 */
export declare function onPreToolUse(toolName: string, toolUseId: string, toolInput: Record<string, unknown>, sessionId: string, projectDir?: string, permissionMode?: string): Promise<PreToolHookResult>;
/**
 *
 */
export declare function onPostToolUse(toolName: string, toolUseId: string, toolInput: Record<string, unknown>, toolResult: {
    success: boolean;
    llmContent?: string;
}, sessionId: string, projectDir?: string, permissionMode?: string): Promise<PostToolHookResult>;
/**
 *
 */
export declare function onPostToolUseFailure(toolName: string, toolUseId: string, toolInput: Record<string, unknown>, errorMessage: string, sessionId: string, projectDir?: string, permissionMode?: string): Promise<void>;
/**
 *
 * @returns 'approve' | 'deny' | 'ask'
 */
export declare function onPermissionRequest(toolName: string, toolInput: Record<string, unknown>, sessionId: string, projectDir?: string, permissionMode?: string): Promise<'approve' | 'deny' | 'ask'>;
//# sourceMappingURL=HookService.d.ts.map