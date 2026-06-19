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
        name?: string | undefined;
        id?: string | undefined;
        provider?: "openai-compatible" | "anthropic" | undefined;
        apiKey?: string | undefined;
        baseURL?: string | undefined;
        model?: string | undefined;
        temperature?: number | undefined;
        maxContextTokens?: number | undefined;
        topP?: number | undefined;
        topK?: number | undefined;
    } | undefined;
    temperature?: number | undefined;
    maxContextTokens?: number | undefined;
    theme?: string | undefined;
    env?: Record<string, string> | undefined;
    timeout?: number | undefined;
    models?: {
        name?: string | undefined;
        id?: string | undefined;
        provider?: "openai-compatible" | "anthropic" | undefined;
        apiKey?: string | undefined;
        baseURL?: string | undefined;
        model?: string | undefined;
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
        deny: string[];
        ask: string[];
    } | undefined;
    defaultPermissionMode?: "default" | "autoEdit" | "yolo" | "plan" | undefined;
    toolWhitelist?: string[] | undefined;
    toolBlacklist?: string[] | undefined;
    mcpServers?: Record<string, {
        type: "stdio" | "sse" | "http";
        enabled?: boolean | undefined;
        command?: string | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
        cwd?: string | undefined;
        url?: string | undefined;
        headers?: Record<string, string> | undefined;
        timeout?: number | undefined;
        description?: string | undefined;
        healthCheck?: {
            enabled: boolean;
            intervalMs: number;
            timeoutMs: number;
            maxFailures: number;
        } | undefined;
    }> | undefined;
    mcpEnabled?: boolean | undefined;
    hooks?: {
        enabled?: boolean | undefined;
        defaultTimeout?: number | undefined;
        timeoutBehavior?: "ignore" | "deny" | "ask" | undefined;
        failureBehavior?: "ignore" | "deny" | "ask" | undefined;
        maxConcurrentHooks?: number | undefined;
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
    } | undefined;
    maxOutputTokens?: number | undefined;
    stream?: boolean | undefined;
    language?: string | undefined;
    debug?: string | boolean | undefined;
    autoRouter?: {
        enabled?: boolean | undefined;
        tiers?: {
            simple?: string | undefined;
            medium?: string | undefined;
            complex?: string | undefined;
        } | undefined;
    } | undefined;
    thinking?: {
        budget?: "medium" | "off" | "low" | "high" | "max" | undefined;
    } | undefined;
    maxTurns?: number | undefined;
    systemPrompt?: string | undefined;
    appendSystemPrompt?: string | undefined;
    initialMessage?: string | undefined;
    resumeSessionId?: string | undefined;
    forkSession?: boolean | undefined;
    allowedTools?: string[] | undefined;
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
    name?: string | undefined;
    id?: string | undefined;
    provider?: "openai-compatible" | "anthropic" | undefined;
    apiKey?: string | undefined;
    baseURL?: string | undefined;
    model?: string | undefined;
    temperature?: number | undefined;
    maxContextTokens?: number | undefined;
    topP?: number | undefined;
    topK?: number | undefined;
}[];
/**
 *
 */
export declare const useCurrentModel: () => {
    name?: string | undefined;
    id?: string | undefined;
    provider?: "openai-compatible" | "anthropic" | undefined;
    apiKey?: string | undefined;
    baseURL?: string | undefined;
    model?: string | undefined;
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
export declare const useAutoRouterActiveModel: () => string | null;
export declare const useRouterEnabled: () => boolean;
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