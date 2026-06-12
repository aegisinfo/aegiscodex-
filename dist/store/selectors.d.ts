/**
 * Store 选择器
 *
 *
 */
import type { ClawdStore, SessionMessage, TodoItem, FocusId } from './types.js';
import type { PermissionMode } from '../config/types.js';
/**
 * React Hook - 订阅 Clawd Store
 */
export declare function useClawdStore<T>(selector: (state: ClawdStore) => T): T;
export declare const useSessionId: () => string;
export declare const useMessages: () => SessionMessage[];
export declare const useIsThinking: () => boolean;
export declare const useIsCompacting: () => boolean;
export declare const useSessionError: () => string | null;
export declare const useCurrentCommand: () => string | null;
export declare const useTokenUsage: () => import("./types.js").TokenUsage;
export declare const useConfig: () => {
    default?: {
        apiKey?: string | undefined;
        baseURL?: string | undefined;
        name?: string | undefined;
        id?: string | undefined;
        model?: string | undefined;
        provider?: "openai-compatible" | "anthropic" | undefined;
        temperature?: number | undefined;
        maxContextTokens?: number | undefined;
        topP?: number | undefined;
        topK?: number | undefined;
    } | undefined;
    timeout?: number | undefined;
    allowedTools?: string[] | undefined;
    temperature?: number | undefined;
    maxContextTokens?: number | undefined;
    theme?: string | undefined;
    env?: Record<string, string> | undefined;
    models?: {
        apiKey?: string | undefined;
        baseURL?: string | undefined;
        name?: string | undefined;
        id?: string | undefined;
        model?: string | undefined;
        provider?: "openai-compatible" | "anthropic" | undefined;
        temperature?: number | undefined;
        maxContextTokens?: number | undefined;
        topP?: number | undefined;
        topK?: number | undefined;
    }[] | undefined;
    currentModelId?: string | undefined;
    ui?: {
        theme?: string | undefined;
    } | undefined;
    permissions?: {
        allow: string[];
        ask: string[];
        deny: string[];
    } | undefined;
    defaultPermissionMode?: "default" | "autoEdit" | "yolo" | "plan" | undefined;
    toolWhitelist?: string[] | undefined;
    toolBlacklist?: string[] | undefined;
    mcpServers?: Record<string, {
        type: "stdio" | "sse" | "http";
        timeout?: number | undefined;
        description?: string | undefined;
        cwd?: string | undefined;
        command?: string | undefined;
        args?: string[] | undefined;
        enabled?: boolean | undefined;
        env?: Record<string, string> | undefined;
        url?: string | undefined;
        headers?: Record<string, string> | undefined;
        healthCheck?: {
            enabled: boolean;
            intervalMs: number;
            timeoutMs: number;
            maxFailures: number;
        } | undefined;
    }> | undefined;
    mcpEnabled?: boolean | undefined;
    hooks?: {
        PreToolUse?: any[] | undefined;
        PostToolUse?: any[] | undefined;
        PostToolUseFailure?: any[] | undefined;
        PermissionRequest?: any[] | undefined;
        UserPromptSubmit?: any[] | undefined;
        SessionStart?: any[] | undefined;
        SessionEnd?: any[] | undefined;
        Stop?: any[] | undefined;
        SubagentStop?: any[] | undefined;
        Notification?: any[] | undefined;
        Compaction?: any[] | undefined;
        enabled?: boolean | undefined;
        defaultTimeout?: number | undefined;
        timeoutBehavior?: "ignore" | "ask" | "deny" | undefined;
        failureBehavior?: "ignore" | "ask" | "deny" | undefined;
        maxConcurrentHooks?: number | undefined;
    } | undefined;
    maxOutputTokens?: number | undefined;
    stream?: boolean | undefined;
    language?: string | undefined;
    debug?: string | boolean | undefined;
    maxTurns?: number | undefined;
    systemPrompt?: string | undefined;
    appendSystemPrompt?: string | undefined;
    initialMessage?: string | undefined;
    resumeSessionId?: string | undefined;
    forkSession?: boolean | undefined;
    disallowedTools?: string[] | undefined;
    mcpConfigPaths?: string[] | undefined;
    strictMcpConfig?: boolean | undefined;
    fallbackModel?: string | undefined;
    addDirs?: string[] | undefined;
    outputFormat?: "text" | "json" | "stream-json" | undefined;
    print?: boolean | undefined;
} | null;
export declare const useTheme: () => string;
export declare const usePermissionMode: () => PermissionMode;
export declare const useAllModels: () => {
    apiKey?: string | undefined;
    baseURL?: string | undefined;
    name?: string | undefined;
    id?: string | undefined;
    model?: string | undefined;
    provider?: "openai-compatible" | "anthropic" | undefined;
    temperature?: number | undefined;
    maxContextTokens?: number | undefined;
    topP?: number | undefined;
    topK?: number | undefined;
}[];
/**
 *
 */
export declare const useCurrentModel: () => {
    apiKey?: string | undefined;
    baseURL?: string | undefined;
    name?: string | undefined;
    id?: string | undefined;
    model?: string | undefined;
    provider?: "openai-compatible" | "anthropic" | undefined;
    temperature?: number | undefined;
    maxContextTokens?: number | undefined;
    topP?: number | undefined;
    topK?: number | undefined;
} | undefined;
export declare const useInitializationStatus: () => import("./types.js").InitializationStatus;
export declare const useInitializationError: () => string | null;
export declare const useActiveModal: () => import("./types.js").ActiveModal;
export declare const useTodos: () => TodoItem[];
export declare const useAwaitingSecondCtrlC: () => boolean;
export declare const useShowAllThinking: () => boolean;
export declare const useCurrentFocus: () => FocusId;
export declare const usePreviousFocus: () => FocusId | null;
export declare const useIsProcessing: () => boolean;
export declare const usePendingCommands: () => string[];
/**
 *
 */
export declare const useContextRemaining: () => number;
/**
 *
 */
export declare const useIsInputDisabled: () => boolean;
/**
 *
 */
export declare const useIsBusy: () => boolean;
/**
 *
 */
export declare const useTodoStats: () => {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
};
/**
 *
 */
export declare const useMessageCount: () => number;
/**
 *
 */
export declare const useMessageById: (id: string) => SessionMessage | undefined;
/**
 *
 */
export declare const useMessageIds: () => string[];
/**
 *
 */
export declare const useHasStreamingMessage: () => boolean;
/**
 *
 */
export declare const useStreamingMessageId: () => string | null;
/**
 *
 */
export declare const useSessionState: () => {
    sessionId: string;
    messages: SessionMessage[];
    isThinking: boolean;
    currentCommand: string | null;
    error: string | null;
};
/**
 *
 */
export declare const useAppState: () => {
    initializationStatus: import("./types.js").InitializationStatus;
    initializationError: string | null;
    activeModal: import("./types.js").ActiveModal;
};
//# sourceMappingURL=selectors.d.ts.map