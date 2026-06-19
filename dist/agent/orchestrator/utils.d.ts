/**
 * Orchestrator shared utilities
 *
 * Centralises model resolution, tool setup, and config construction
 * so that every slash-command (/multi, /research, …) does not repeat
 * the same boilerplate.
 */
import { ExecutionPipeline, PermissionMode } from '../../tools/index.js';
export interface ResolvedModelConfig {
    model: string;
    baseURL?: string;
    apiKey: string;
    timeout: number;
}
export interface SubAgentOptions {
    model: string;
    baseURL?: string;
    apiKey: string;
    timeout?: number;
}
/**
 * Resolve model config from the store, config-manager, and env-vars.
 * Falls back through: store → configManager → env → ''
 *
 * This is the single source of truth used by every multi-agent command.
 */
export declare function resolveModelConfig(): ResolvedModelConfig;
/**
 * Pick the matching API key from env based on base URL.
 */
export declare function resolveApiKeyFromEnv(baseURL: string): string;
/**
 * Build a safe ModelConfig object (throws if apiKey is missing).
 */
export declare function requireModelConfig(): ResolvedModelConfig;
/**
 * Create a lightweight tool registry + execution pipeline for sub-agents.
 *
 * When `allowAllBuiltins` is true the agent gets Read/Edit/Write/Grep/Glob/Bash.
 * Otherwise you can pass a list of tool names.
 */
export declare function createSubAgentToolkit(allowedTools?: string[], options?: {
    permissionMode?: PermissionMode;
}): {
    registry: import("../../tools/registry.js").ToolRegistry;
    pipeline: ExecutionPipeline;
};
/**
 * Make a lightweight chat service from a resolved model config.
 */
export declare function createSubAgentChatService(cfg: ResolvedModelConfig): import("../types.js").IChatService;
/**
 * Build a rich source-code context string for a workspace directory.
 *
 * Scans the workspace and provides:
 * - Project metadata (package.json scripts/deps, tsconfig)
 * - Recently changed files (git)
 * - Prioritized file tree (configs & recent changes first)
 * - Structural summaries (exports, classes, functions) for each file
 *
 * Injected into sub-agent system prompts so they know what exists
 * and can target their Read / Grep / Glob calls effectively.
 */
export declare function buildSourceContext(cwd: string, maxFiles?: number, maxTotalChars?: number): string;
//# sourceMappingURL=utils.d.ts.map