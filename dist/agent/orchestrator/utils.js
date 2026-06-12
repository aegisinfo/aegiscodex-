/**
 * Orchestrator shared utilities
 *
 * Centralises model resolution, tool setup, and config construction
 * so that every slash-command (/multi, /research, …) does not repeat
 * the same boilerplate.
 */
import { createChatService } from '../../services/ChatService.js';
import { createToolRegistry, getBuiltinTools, ExecutionPipeline, PermissionMode } from '../../tools/index.js';
import { configManager } from '../../config/ConfigManager.js';
// ─── Defaults ──────────────────────────────────────────────────────
const DEFAULT_TIMEOUT = 180_000; // 3 min – sub-agents need more time
// ─── Model Resolution ──────────────────────────────────────────────
/**
 * Resolve model config from the store, config-manager, and env-vars.
 * Falls back through: store → configManager → env → ''
 *
 * This is the single source of truth used by every multi-agent command.
 */
export function resolveModelConfig() {
    // Try store first
    let model;
    let baseURL;
    let apiKey;
    try {
        // Dynamic import to avoid circular deps at module level
        const store = require('../../store/index.js');
        const currentModel = store.getCurrentModel();
        if (currentModel) {
            model = currentModel.model || currentModel.id;
            baseURL = currentModel.baseURL || currentModel.baseUrl;
            apiKey = currentModel.apiKey;
        }
    }
    catch { /* store not ready */ }
    // Fallback: configManager
    if (!apiKey) {
        try {
            const def = configManager.getDefaultModel();
            if (def) {
                model = model || def.model || def.id;
                baseURL = baseURL || def.baseURL || def.baseUrl;
                apiKey = apiKey || def.apiKey;
            }
        }
        catch { /* config not ready */ }
    }
    // Fallback: env vars
    model = model || process.env.OPENAI_MODEL || '';
    baseURL = baseURL || process.env.OPENAI_BASE_URL || '';
    apiKey = apiKey || resolveApiKeyFromEnv(baseURL || '');
    return { model: model || '', baseURL: baseURL || undefined, apiKey: apiKey || '', timeout: DEFAULT_TIMEOUT };
}
/**
 * Pick the matching API key from env based on base URL.
 */
export function resolveApiKeyFromEnv(baseURL) {
    const bu = baseURL.toLowerCase();
    if (bu.includes('anthropic'))
        return process.env.ANTHROPIC_API_KEY || '';
    if (bu.includes('deepseek'))
        return process.env.DEEPSEEK_API_KEY || '';
    if (bu.includes('groq'))
        return process.env.GROQ_API_KEY || '';
    if (bu.includes('openai'))
        return process.env.OPENAI_API_KEY || '';
    // Wildcard fallback
    return process.env.DEEPSEEK_API_KEY
        || process.env.OPENAI_API_KEY
        || process.env.GROQ_API_KEY
        || process.env.ANTHROPIC_API_KEY
        || '';
}
/**
 * Build a safe ModelConfig object (throws if apiKey is missing).
 */
export function requireModelConfig() {
    const cfg = resolveModelConfig();
    if (!cfg.apiKey) {
        throw new Error('No API key configured. Set DEEPSEEK_API_KEY, OPENAI_API_KEY, ' +
            'GROQ_API_KEY, or ANTHROPIC_API_KEY in ~/.aegiscode/.env');
    }
    return cfg;
}
// ─── Tool Setup Helpers ────────────────────────────────────────────
/**
 * Create a lightweight tool registry + execution pipeline for sub-agents.
 *
 * When `allowAllBuiltins` is true the agent gets Read/Edit/Write/Grep/Glob/Bash.
 * Otherwise you can pass a list of tool names.
 */
export function createSubAgentToolkit(allowedTools) {
    const registry = createToolRegistry();
    const builtins = getBuiltinTools();
    const names = allowedTools || ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'];
    for (const tool of builtins) {
        if (names.includes(tool.name)) {
            registry.register(tool);
        }
    }
    const pipeline = new ExecutionPipeline(registry, {
        defaultMode: PermissionMode.AUTO_EDIT, // sub-agents run without confirm prompts
    });
    return { registry, pipeline };
}
/**
 * Make a lightweight chat service from a resolved model config.
 */
export function createSubAgentChatService(cfg) {
    return createChatService({
        apiKey: cfg.apiKey,
        baseURL: cfg.baseURL,
        model: cfg.model,
        timeout: cfg.timeout,
    });
}
//# sourceMappingURL=utils.js.map