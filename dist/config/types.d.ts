/**
 *
 *
 *
 * - config.json: 基础配置（API、模型、UI）
 * - settings.json: 行为配置（权限、Hooks、环境变量）
 */
import { z } from 'zod';
/**
 * LLM API 提供商类型
 */
export type ProviderType = 'openai-compatible' | 'anthropic';
/**
 *
 */
export declare enum PermissionMode {
    DEFAULT = "default",// 只读自动，写入需确
    AUTO_EDIT = "autoEdit",// 只读+写入自动，执行需确
    YOLO = "yolo",// 完全自动（危
    PLAN = "plan"
}
/**
 *
 *
 *
 */
export declare const ModelConfigSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    provider: z.ZodOptional<z.ZodEnum<["openai-compatible", "anthropic"]>>;
    apiKey: z.ZodOptional<z.ZodString>;
    baseURL: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    temperature: z.ZodOptional<z.ZodNumber>;
    maxContextTokens: z.ZodOptional<z.ZodNumber>;
    topP: z.ZodOptional<z.ZodNumber>;
    topK: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
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
}, {
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
}>;
/**
 *
 */
export declare const PRESET_THEME_IDS: readonly ["default", "light", "dark", "ocean", "forest", "sunset"];
export type PresetThemeId = typeof PRESET_THEME_IDS[number];
/**
 * UI 配置 Schema
 */
export declare const UIConfigSchema: z.ZodObject<{
    theme: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    theme?: string | undefined;
}, {
    theme?: string | undefined;
}>;
/**
 * Auto-router Schema — per-tier model id overrides for simple/medium/complex tasks
 */
export declare const AutoRouterConfigSchema: z.ZodObject<{
    enabled: z.ZodOptional<z.ZodBoolean>;
    tiers: z.ZodOptional<z.ZodObject<{
        simple: z.ZodOptional<z.ZodString>;
        medium: z.ZodOptional<z.ZodString>;
        complex: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        simple?: string | undefined;
        medium?: string | undefined;
        complex?: string | undefined;
    }, {
        simple?: string | undefined;
        medium?: string | undefined;
        complex?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    enabled?: boolean | undefined;
    tiers?: {
        simple?: string | undefined;
        medium?: string | undefined;
        complex?: string | undefined;
    } | undefined;
}, {
    enabled?: boolean | undefined;
    tiers?: {
        simple?: string | undefined;
        medium?: string | undefined;
        complex?: string | undefined;
    } | undefined;
}>;
/**
 * Extended-thinking Schema — budget tier sent as `thinking.budget_tokens` to
 * Anthropic models that support it. 'off' omits the thinking param entirely.
 */
export declare const ThinkingConfigSchema: z.ZodObject<{
    budget: z.ZodOptional<z.ZodEnum<["off", "low", "medium", "high", "max"]>>;
}, "strip", z.ZodTypeAny, {
    budget?: "medium" | "off" | "low" | "high" | "max" | undefined;
}, {
    budget?: "medium" | "off" | "low" | "high" | "max" | undefined;
}>;
/**
 *
 */
export declare const PermissionConfigSchema: z.ZodObject<{
    allow: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    deny: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    ask: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    allow: string[];
    deny: string[];
    ask: string[];
}, {
    allow?: string[] | undefined;
    deny?: string[] | undefined;
    ask?: string[] | undefined;
}>;
/**
 * MCP 服务器配置 Schema
 */
export declare const McpServerConfigSchema: z.ZodObject<{
    type: z.ZodEnum<["stdio", "sse", "http"]>;
    command: z.ZodOptional<z.ZodString>;
    args: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    cwd: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    enabled: z.ZodOptional<z.ZodBoolean>;
    timeout: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
    healthCheck: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        intervalMs: z.ZodNumber;
        timeoutMs: z.ZodNumber;
        maxFailures: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        intervalMs: number;
        timeoutMs: number;
        maxFailures: number;
    }, {
        enabled: boolean;
        intervalMs: number;
        timeoutMs: number;
        maxFailures: number;
    }>>;
}, "strip", z.ZodTypeAny, {
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
}, {
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
}>;
/**
 * Hook 配置 Schema
 *
 *
 *
 */
export declare const HookConfigSchema: z.ZodOptional<z.ZodObject<{
    enabled: z.ZodOptional<z.ZodBoolean>;
    defaultTimeout: z.ZodOptional<z.ZodNumber>;
    timeoutBehavior: z.ZodOptional<z.ZodEnum<["ignore", "deny", "ask"]>>;
    failureBehavior: z.ZodOptional<z.ZodEnum<["ignore", "deny", "ask"]>>;
    maxConcurrentHooks: z.ZodOptional<z.ZodNumber>;
    PreToolUse: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    PostToolUse: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    PostToolUseFailure: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    PermissionRequest: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    UserPromptSubmit: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    SessionStart: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    SessionEnd: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    Stop: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    SubagentStop: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    Notification: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    Compaction: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
}, "strip", z.ZodTypeAny, {
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
}, {
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
}>>;
/**
 *
 */
export declare const ConfigSchema: z.ZodObject<{
    default: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        provider: z.ZodOptional<z.ZodEnum<["openai-compatible", "anthropic"]>>;
        apiKey: z.ZodOptional<z.ZodString>;
        baseURL: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        temperature: z.ZodOptional<z.ZodNumber>;
        maxContextTokens: z.ZodOptional<z.ZodNumber>;
        topP: z.ZodOptional<z.ZodNumber>;
        topK: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
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
    }, {
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
    }>>;
    models: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        provider: z.ZodOptional<z.ZodEnum<["openai-compatible", "anthropic"]>>;
        apiKey: z.ZodOptional<z.ZodString>;
        baseURL: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        temperature: z.ZodOptional<z.ZodNumber>;
        maxContextTokens: z.ZodOptional<z.ZodNumber>;
        topP: z.ZodOptional<z.ZodNumber>;
        topK: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
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
    }, {
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
    }>, "many">>;
    currentModelId: z.ZodOptional<z.ZodString>;
    ui: z.ZodOptional<z.ZodObject<{
        theme: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        theme?: string | undefined;
    }, {
        theme?: string | undefined;
    }>>;
    theme: z.ZodOptional<z.ZodString>;
    permissions: z.ZodOptional<z.ZodObject<{
        allow: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        deny: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        ask: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        allow: string[];
        deny: string[];
        ask: string[];
    }, {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
    }>>;
    defaultPermissionMode: z.ZodOptional<z.ZodEnum<["default", "autoEdit", "yolo", "plan"]>>;
    toolWhitelist: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    toolBlacklist: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    mcpServers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        type: z.ZodEnum<["stdio", "sse", "http"]>;
        command: z.ZodOptional<z.ZodString>;
        args: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        cwd: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        enabled: z.ZodOptional<z.ZodBoolean>;
        timeout: z.ZodOptional<z.ZodNumber>;
        description: z.ZodOptional<z.ZodString>;
        healthCheck: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            intervalMs: z.ZodNumber;
            timeoutMs: z.ZodNumber;
            maxFailures: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            intervalMs: number;
            timeoutMs: number;
            maxFailures: number;
        }, {
            enabled: boolean;
            intervalMs: number;
            timeoutMs: number;
            maxFailures: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
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
    }, {
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
    }>>>;
    mcpEnabled: z.ZodOptional<z.ZodBoolean>;
    hooks: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodOptional<z.ZodBoolean>;
        defaultTimeout: z.ZodOptional<z.ZodNumber>;
        timeoutBehavior: z.ZodOptional<z.ZodEnum<["ignore", "deny", "ask"]>>;
        failureBehavior: z.ZodOptional<z.ZodEnum<["ignore", "deny", "ask"]>>;
        maxConcurrentHooks: z.ZodOptional<z.ZodNumber>;
        PreToolUse: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        PostToolUse: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        PostToolUseFailure: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        PermissionRequest: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        UserPromptSubmit: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        SessionStart: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        SessionEnd: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        Stop: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        SubagentStop: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        Notification: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        Compaction: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    }, "strip", z.ZodTypeAny, {
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
    }, {
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
    }>>;
}, "strip", z.ZodTypeAny, {
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
    theme?: string | undefined;
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
}, {
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
    theme?: string | undefined;
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
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
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
}>;
/**
 *
 *
 */
export declare const ClawdConfigSchema: z.ZodObject<{
    default: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        provider: z.ZodOptional<z.ZodEnum<["openai-compatible", "anthropic"]>>;
        apiKey: z.ZodOptional<z.ZodString>;
        baseURL: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        temperature: z.ZodOptional<z.ZodNumber>;
        maxContextTokens: z.ZodOptional<z.ZodNumber>;
        topP: z.ZodOptional<z.ZodNumber>;
        topK: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
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
    }, {
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
    }>>;
    currentModelId: z.ZodOptional<z.ZodString>;
    models: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        provider: z.ZodOptional<z.ZodEnum<["openai-compatible", "anthropic"]>>;
        apiKey: z.ZodOptional<z.ZodString>;
        baseURL: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        temperature: z.ZodOptional<z.ZodNumber>;
        maxContextTokens: z.ZodOptional<z.ZodNumber>;
        topP: z.ZodOptional<z.ZodNumber>;
        topK: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
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
    }, {
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
    }>, "many">>;
    temperature: z.ZodOptional<z.ZodNumber>;
    maxContextTokens: z.ZodOptional<z.ZodNumber>;
    maxOutputTokens: z.ZodOptional<z.ZodNumber>;
    stream: z.ZodOptional<z.ZodBoolean>;
    timeout: z.ZodOptional<z.ZodNumber>;
    ui: z.ZodOptional<z.ZodObject<{
        theme: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        theme?: string | undefined;
    }, {
        theme?: string | undefined;
    }>>;
    theme: z.ZodOptional<z.ZodString>;
    language: z.ZodOptional<z.ZodString>;
    debug: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodBoolean]>>;
    mcpEnabled: z.ZodOptional<z.ZodBoolean>;
    mcpServers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        type: z.ZodEnum<["stdio", "sse", "http"]>;
        command: z.ZodOptional<z.ZodString>;
        args: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        cwd: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        enabled: z.ZodOptional<z.ZodBoolean>;
        timeout: z.ZodOptional<z.ZodNumber>;
        description: z.ZodOptional<z.ZodString>;
        healthCheck: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            intervalMs: z.ZodNumber;
            timeoutMs: z.ZodNumber;
            maxFailures: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            intervalMs: number;
            timeoutMs: number;
            maxFailures: number;
        }, {
            enabled: boolean;
            intervalMs: number;
            timeoutMs: number;
            maxFailures: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
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
    }, {
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
    }>>>;
    autoRouter: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodOptional<z.ZodBoolean>;
        tiers: z.ZodOptional<z.ZodObject<{
            simple: z.ZodOptional<z.ZodString>;
            medium: z.ZodOptional<z.ZodString>;
            complex: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            simple?: string | undefined;
            medium?: string | undefined;
            complex?: string | undefined;
        }, {
            simple?: string | undefined;
            medium?: string | undefined;
            complex?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        enabled?: boolean | undefined;
        tiers?: {
            simple?: string | undefined;
            medium?: string | undefined;
            complex?: string | undefined;
        } | undefined;
    }, {
        enabled?: boolean | undefined;
        tiers?: {
            simple?: string | undefined;
            medium?: string | undefined;
            complex?: string | undefined;
        } | undefined;
    }>>;
    thinking: z.ZodOptional<z.ZodObject<{
        budget: z.ZodOptional<z.ZodEnum<["off", "low", "medium", "high", "max"]>>;
    }, "strip", z.ZodTypeAny, {
        budget?: "medium" | "off" | "low" | "high" | "max" | undefined;
    }, {
        budget?: "medium" | "off" | "low" | "high" | "max" | undefined;
    }>>;
    permissions: z.ZodOptional<z.ZodObject<{
        allow: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        deny: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        ask: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        allow: string[];
        deny: string[];
        ask: string[];
    }, {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
    }>>;
    defaultPermissionMode: z.ZodOptional<z.ZodEnum<["default", "autoEdit", "yolo", "plan"]>>;
    toolWhitelist: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    toolBlacklist: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    hooks: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodOptional<z.ZodBoolean>;
        defaultTimeout: z.ZodOptional<z.ZodNumber>;
        timeoutBehavior: z.ZodOptional<z.ZodEnum<["ignore", "deny", "ask"]>>;
        failureBehavior: z.ZodOptional<z.ZodEnum<["ignore", "deny", "ask"]>>;
        maxConcurrentHooks: z.ZodOptional<z.ZodNumber>;
        PreToolUse: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        PostToolUse: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        PostToolUseFailure: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        PermissionRequest: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        UserPromptSubmit: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        SessionStart: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        SessionEnd: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        Stop: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        SubagentStop: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        Notification: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        Compaction: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    }, "strip", z.ZodTypeAny, {
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
    }, {
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
    }>>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    maxTurns: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
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
}, {
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
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
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
}>;
/**
 *
 *
 */
export declare const RuntimeConfigSchema: z.ZodObject<{
    default: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        provider: z.ZodOptional<z.ZodEnum<["openai-compatible", "anthropic"]>>;
        apiKey: z.ZodOptional<z.ZodString>;
        baseURL: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        temperature: z.ZodOptional<z.ZodNumber>;
        maxContextTokens: z.ZodOptional<z.ZodNumber>;
        topP: z.ZodOptional<z.ZodNumber>;
        topK: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
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
    }, {
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
    }>>;
    currentModelId: z.ZodOptional<z.ZodString>;
    models: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        provider: z.ZodOptional<z.ZodEnum<["openai-compatible", "anthropic"]>>;
        apiKey: z.ZodOptional<z.ZodString>;
        baseURL: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        temperature: z.ZodOptional<z.ZodNumber>;
        maxContextTokens: z.ZodOptional<z.ZodNumber>;
        topP: z.ZodOptional<z.ZodNumber>;
        topK: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
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
    }, {
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
    }>, "many">>;
    temperature: z.ZodOptional<z.ZodNumber>;
    maxContextTokens: z.ZodOptional<z.ZodNumber>;
    maxOutputTokens: z.ZodOptional<z.ZodNumber>;
    stream: z.ZodOptional<z.ZodBoolean>;
    timeout: z.ZodOptional<z.ZodNumber>;
    ui: z.ZodOptional<z.ZodObject<{
        theme: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        theme?: string | undefined;
    }, {
        theme?: string | undefined;
    }>>;
    theme: z.ZodOptional<z.ZodString>;
    language: z.ZodOptional<z.ZodString>;
    debug: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodBoolean]>>;
    mcpEnabled: z.ZodOptional<z.ZodBoolean>;
    mcpServers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        type: z.ZodEnum<["stdio", "sse", "http"]>;
        command: z.ZodOptional<z.ZodString>;
        args: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        cwd: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        enabled: z.ZodOptional<z.ZodBoolean>;
        timeout: z.ZodOptional<z.ZodNumber>;
        description: z.ZodOptional<z.ZodString>;
        healthCheck: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            intervalMs: z.ZodNumber;
            timeoutMs: z.ZodNumber;
            maxFailures: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            intervalMs: number;
            timeoutMs: number;
            maxFailures: number;
        }, {
            enabled: boolean;
            intervalMs: number;
            timeoutMs: number;
            maxFailures: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
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
    }, {
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
    }>>>;
    autoRouter: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodOptional<z.ZodBoolean>;
        tiers: z.ZodOptional<z.ZodObject<{
            simple: z.ZodOptional<z.ZodString>;
            medium: z.ZodOptional<z.ZodString>;
            complex: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            simple?: string | undefined;
            medium?: string | undefined;
            complex?: string | undefined;
        }, {
            simple?: string | undefined;
            medium?: string | undefined;
            complex?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        enabled?: boolean | undefined;
        tiers?: {
            simple?: string | undefined;
            medium?: string | undefined;
            complex?: string | undefined;
        } | undefined;
    }, {
        enabled?: boolean | undefined;
        tiers?: {
            simple?: string | undefined;
            medium?: string | undefined;
            complex?: string | undefined;
        } | undefined;
    }>>;
    thinking: z.ZodOptional<z.ZodObject<{
        budget: z.ZodOptional<z.ZodEnum<["off", "low", "medium", "high", "max"]>>;
    }, "strip", z.ZodTypeAny, {
        budget?: "medium" | "off" | "low" | "high" | "max" | undefined;
    }, {
        budget?: "medium" | "off" | "low" | "high" | "max" | undefined;
    }>>;
    permissions: z.ZodOptional<z.ZodObject<{
        allow: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        deny: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        ask: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        allow: string[];
        deny: string[];
        ask: string[];
    }, {
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
    }>>;
    defaultPermissionMode: z.ZodOptional<z.ZodEnum<["default", "autoEdit", "yolo", "plan"]>>;
    toolWhitelist: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    toolBlacklist: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    hooks: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodOptional<z.ZodBoolean>;
        defaultTimeout: z.ZodOptional<z.ZodNumber>;
        timeoutBehavior: z.ZodOptional<z.ZodEnum<["ignore", "deny", "ask"]>>;
        failureBehavior: z.ZodOptional<z.ZodEnum<["ignore", "deny", "ask"]>>;
        maxConcurrentHooks: z.ZodOptional<z.ZodNumber>;
        PreToolUse: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        PostToolUse: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        PostToolUseFailure: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        PermissionRequest: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        UserPromptSubmit: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        SessionStart: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        SessionEnd: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        Stop: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        SubagentStop: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        Notification: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        Compaction: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    }, "strip", z.ZodTypeAny, {
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
    }, {
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
    }>>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    maxTurns: z.ZodOptional<z.ZodNumber>;
} & {
    systemPrompt: z.ZodOptional<z.ZodString>;
    appendSystemPrompt: z.ZodOptional<z.ZodString>;
    initialMessage: z.ZodOptional<z.ZodString>;
    resumeSessionId: z.ZodOptional<z.ZodString>;
    forkSession: z.ZodOptional<z.ZodBoolean>;
    allowedTools: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    disallowedTools: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    mcpConfigPaths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    strictMcpConfig: z.ZodOptional<z.ZodBoolean>;
    fallbackModel: z.ZodOptional<z.ZodString>;
    addDirs: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    outputFormat: z.ZodOptional<z.ZodEnum<["text", "json", "stream-json"]>>;
    print: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
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
}, {
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
        allow?: string[] | undefined;
        deny?: string[] | undefined;
        ask?: string[] | undefined;
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
}>;
export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type UIConfig = z.infer<typeof UIConfigSchema>;
export type AutoRouterConfig = z.infer<typeof AutoRouterConfigSchema>;
export type ThinkingConfig = z.infer<typeof ThinkingConfigSchema>;
export type PermissionConfig = z.infer<typeof PermissionConfigSchema>;
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;
export type HookConfig = z.infer<typeof HookConfigSchema>;
export type ClawdConfig = z.infer<typeof ClawdConfigSchema>;
export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;
export type Config = ClawdConfig;
export type MergeStrategy = 'replace' | 'append-dedupe' | 'deep-merge';
export type ConfigTarget = 'config' | 'settings';
export type ConfigScope = 'local' | 'project' | 'global';
export interface FieldRouting {
    target: ConfigTarget;
    defaultScope: ConfigScope;
    mergeStrategy: MergeStrategy;
    persistable: boolean;
}
/**
 *
 */
export declare const FIELD_ROUTING_TABLE: Record<string, FieldRouting>;
/**
 *
 */
export declare const DEFAULT_PERMISSIONS: PermissionConfig;
/**
 *
 */
export declare const DEFAULT_MODELS: ({
    id: string;
    name: string;
    provider: "anthropic";
    model: string;
    baseURL: string;
    apiKey: string;
} | {
    id: string;
    name: string;
    provider: "openai-compatible";
    model: string;
    baseURL: string;
    apiKey: string;
})[];
export declare const DEFAULT_CONFIG: ClawdConfig;
//# sourceMappingURL=types.d.ts.map