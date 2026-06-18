/**
 * Orchestrator shared utilities
 *
 * Centralises model resolution, tool setup, and config construction
 * so that every slash-command (/multi, /research, …) does not repeat
 * the same boilerplate.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createChatService } from '../../services/ChatService.js';
import { createToolRegistry, getBuiltinTools, ExecutionPipeline, PermissionMode } from '../../tools/index.js';
import { configManager } from '../../config/ConfigManager.js';

// ─── Types ────────────────────────────────────────────────────────

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

// ─── Defaults ──────────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 180_000; // 3 min – sub-agents need more time

// ─── Model Resolution ──────────────────────────────────────────────

/**
 * Resolve model config from the store, config-manager, and env-vars.
 * Falls back through: store → configManager → env → ''
 *
 * This is the single source of truth used by every multi-agent command.
 */
export function resolveModelConfig(): ResolvedModelConfig {
  // Try store first
  let model: string | undefined;
  let baseURL: string | undefined;
  let apiKey: string | undefined;

  try {
    // Dynamic import to avoid circular deps at module level
    const store = require('../../store/index.js');
    const currentModel = store.getCurrentModel();
    if (currentModel) {
      model  = (currentModel as any).model || (currentModel as any).id;
      baseURL = (currentModel as any).baseURL || (currentModel as any).baseUrl;
      apiKey  = (currentModel as any).apiKey;
    }
  } catch { /* store not ready */ }

  // Fallback: configManager
  if (!apiKey) {
    try {
      const def = configManager.getDefaultModel() as any;
      if (def) {
        model   = model   || def.model || def.id;
        baseURL = baseURL || def.baseURL || def.baseUrl;
        apiKey  = apiKey  || def.apiKey;
      }
    } catch { /* config not ready */ }
  }

  // Fallback: env vars
  model   = model   || process.env.OPENAI_MODEL || '';
  baseURL = baseURL || process.env.OPENAI_BASE_URL || '';
  apiKey  = apiKey  || resolveApiKeyFromEnv(baseURL || '');

  return { model: model || '', baseURL: baseURL || undefined, apiKey: apiKey || '', timeout: DEFAULT_TIMEOUT };
}

/**
 * Pick the matching API key from env based on base URL.
 */
export function resolveApiKeyFromEnv(baseURL: string): string {
  const bu = baseURL.toLowerCase();
  if (bu.includes('anthropic'))    return process.env.ANTHROPIC_API_KEY || '';
  if (bu.includes('deepseek'))     return process.env.DEEPSEEK_API_KEY || '';
  if (bu.includes('groq'))         return process.env.GROQ_API_KEY || '';
  if (bu.includes('openai'))       return process.env.OPENAI_API_KEY || '';
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
export function requireModelConfig(): ResolvedModelConfig {
  const cfg = resolveModelConfig();
  if (!cfg.apiKey) {
    throw new Error(
      'No API key configured. Set DEEPSEEK_API_KEY, OPENAI_API_KEY, ' +
      'GROQ_API_KEY, or ANTHROPIC_API_KEY in ~/.aegiscode/.env'
    );
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
export function createSubAgentToolkit(allowedTools?: string[], options?: { permissionMode?: PermissionMode }) {
  const registry = createToolRegistry();
  const builtins = getBuiltinTools();

  const names = allowedTools || ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'];
  for (const tool of builtins) {
    if (names.includes(tool.name)) {
      registry.register(tool);
    }
  }

  const mode = options?.permissionMode || resolveDefaultPermissionMode();
  const pipeline = new ExecutionPipeline(registry, {
    defaultMode: mode,
  });

  return { registry, pipeline };
}

/**
 * Read the user's configured permission mode, falling back to DEFAULT (ask for confirmation).
 */
function resolveDefaultPermissionMode(): PermissionMode {
  try {
    const mode = configManager.getDefaultPermissionMode();
    switch (mode) {
      case 'autoEdit': return PermissionMode.AUTO_EDIT;
      case 'yolo':     return PermissionMode.YOLO;
      case 'plan':     return PermissionMode.PLAN;
      default:         return PermissionMode.DEFAULT;
    }
  } catch {
    return PermissionMode.DEFAULT;
  }
}

/**
 * Make a lightweight chat service from a resolved model config.
 */
export function createSubAgentChatService(cfg: ResolvedModelConfig) {
  return createChatService({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    model: cfg.model,
    timeout: cfg.timeout,
  });
}

// ─── Workspace Source Context ─────────────────────────────────────

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.turbo',
  'coverage', '.nyc_output', '__pycache__', '.cache', 'target',
  'vendor', '.venv', 'venv', '.aegiscode', '.claude',
]);

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rs', '.go', '.java', '.rb', '.php',
  '.vue', '.svelte', '.css', '.scss', '.html',
  '.json', '.yaml', '.yml', '.toml',
]);

/**
 * Build a compact source-code context string for a workspace directory.
 *
 * Scans the workspace keeping file count under a max to avoid bloat,
 * and includes the first N lines of key files that fit within a token budget.
 *
 * Result is injected into sub-agent system prompts so they know what
 * files exist and can target their Read / Grep / Glob calls.
 */
export function buildSourceContext(
  cwd: string,
  maxFiles = 30,
  maxPreviewLines = 20,
  maxTotalChars = 6000,
): string {
  try {
    const allFiles = listSourceFiles(cwd, maxFiles);
    if (allFiles.length === 0) return '';

    const lines: string[] = [];
    lines.push('--- WORKSPACE SOURCE FILES ---');
    lines.push(`Directory: ${cwd}`);
    lines.push('');

    // File tree
    for (const f of allFiles) {
      const display = path.relative(cwd, f);
      lines.push(`  ${display}`);
    }
    lines.push('');

    // Previews of key files (keep under char budget)
    let budget = maxTotalChars;
    for (const f of allFiles.slice(0, 8)) {
      if (budget <= 0) break;
      try {
        const content = fs.readFileSync(f, 'utf8');
        const rel = path.relative(cwd, f);
        const preview = content.split('\n').slice(0, maxPreviewLines).join('\n');
        const header = `--- ${rel} ---`;
        const block = `\n${header}\n${preview}\n`;
        if (block.length < budget - 200) {
          lines.push(block);
          budget -= block.length;
        }
      } catch { /* skip unreadable */ }
    }

    lines.push('--- END WORKSPACE SOURCE ---');
    return lines.join('\n');
  } catch {
    return '';
  }
}

function listSourceFiles(dir: string, max: number): string[] {
  const result: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (result.length >= max) break;
      if (e.name.startsWith('.') || IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        result.push(...listSourceFiles(full, max - result.length));
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (SOURCE_EXTENSIONS.has(ext)) {
          result.push(full);
        }
      }
    }
  } catch { /* skip inaccessible */ }
  return result;
}
