/**
 * Orchestrator shared utilities
 *
 * Centralises model resolution, tool setup, and config construction
 * so that every slash-command (/multi, /research, …) does not repeat
 * the same boilerplate.
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
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
export function createSubAgentToolkit(allowedTools, options) {
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
function resolveDefaultPermissionMode() {
    try {
        const mode = configManager.getDefaultPermissionMode();
        switch (mode) {
            case 'autoEdit': return PermissionMode.AUTO_EDIT;
            case 'yolo': return PermissionMode.YOLO;
            case 'plan': return PermissionMode.PLAN;
            default: return PermissionMode.DEFAULT;
        }
    }
    catch {
        return PermissionMode.DEFAULT;
    }
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
    '.json', '.yaml', '.yml', '.toml', '.prisma',
]);
// Config files that are always included (even if they'd exceed maxFiles)
const ALWAYS_INCLUDE = new Set([
    'package.json', 'tsconfig.json', 'tsconfig.tsbuildinfo',
    '.env.example', 'docker-compose.yml', 'Dockerfile',
    'Makefile', 'Cargo.toml', 'go.mod', 'Gemfile',
    'requirements.txt', 'Pipfile', 'pyproject.toml',
    'wrangler.jsonc', 'wrangler.toml', '.eslintrc.js', '.prettierrc',
]);
/** Extract structural summary (exports / classes / functions / interfaces) from source */
function extractStructure(content) {
    const lines = content.split('\n');
    const sigs = [];
    for (const line of lines) {
        const trimmed = line.trim();
        // Exports
        if (/^export\s+(default\s+)?(function|class|interface|type|enum|const|let|var|async\s+function)/.test(trimmed)) {
            sigs.push(trimmed.replace(/^export\s+default\s+/, 'export default ').replace(/^export\s+/, ''));
        }
        // Top-level function/class defs (non-exported)
        else if (/^(function|class|interface|type|enum|async\s+function)\s+\w+/.test(trimmed)) {
            sigs.push(trimmed);
        }
        // Module-level const/let that looks like a binding (e.g., "const foo = ...")
        else if (/^(const|let|var)\s+\w+\s*[:=]/.test(trimmed) && !trimmed.includes(';') && !trimmed.endsWith(')')) {
            const name = trimmed.match(/^(const|let|var)\s+(\w+)/);
            if (name)
                sigs.push(`${name[1]} ${name[2]} = ...`);
        }
        if (sigs.length >= 30)
            break;
    }
    return sigs.join('\n');
}
/** Try to load a JSON config file and return pretty-printed key fields */
function loadConfigSummary(cwd, name) {
    try {
        const raw = fs.readFileSync(path.join(cwd, name), 'utf8');
        const parsed = JSON.parse(raw);
        if (name === 'package.json') {
            const deps = parsed.dependencies;
            const devDeps = parsed.devDependencies;
            const scripts = parsed.scripts;
            const entries = [`name: ${parsed.name || '(unnamed)'}`];
            if (parsed.type)
                entries.push(`type: ${parsed.type}`);
            if (scripts)
                entries.push(`scripts: ${Object.keys(scripts).join(', ')}`);
            if (deps)
                entries.push(`deps[${Object.keys(deps).length}]: ${Object.keys(deps).slice(0, 20).join(', ')}`);
            if (devDeps)
                entries.push(`devDeps[${Object.keys(devDeps).length}]: ${Object.keys(devDeps).slice(0, 15).join(', ')}`);
            return entries.join('\n');
        }
        if (name === 'tsconfig.json') {
            const compiler = parsed.compilerOptions || {};
            const entries = [];
            if (compiler.target)
                entries.push(`target: ${compiler.target}`);
            if (compiler.module)
                entries.push(`module: ${compiler.module}`);
            if (compiler.outDir)
                entries.push(`outDir: ${compiler.outDir}`);
            if (compiler.rootDir)
                entries.push(`rootDir: ${compiler.rootDir}`);
            if (compiler.paths)
                entries.push(`paths: ${JSON.stringify(compiler.paths)}`);
            return entries.length ? entries.join('\n') : null;
        }
        return null;
    }
    catch {
        return null;
    }
}
/** Get list of recently changed files from git (last N commits) */
function getRecentGitChanges(cwd, max = 10) {
    try {
        const out = execSync('git diff --name-only HEAD~5..HEAD 2>/dev/null || git diff --name-only HEAD~3..HEAD 2>/dev/null || true', {
            cwd,
            encoding: 'utf8',
            timeout: 2000,
        });
        const files = out.split('\n').filter(Boolean).slice(0, max);
        // Only keep source files that actually exist
        return files.filter(f => {
            const ext = path.extname(f).toLowerCase();
            return SOURCE_EXTENSIONS.has(ext) && fs.existsSync(path.join(cwd, f));
        });
    }
    catch {
        return [];
    }
}
/** Sort source files: recently modified first, then alphabetical */
function prioritizeFiles(files, cwd, recentGit) {
    const recentSet = new Set(recentGit.map(f => path.resolve(cwd, f)));
    const isConfig = (f) => ALWAYS_INCLUDE.has(path.basename(f));
    return [...files].sort((a, b) => {
        // Config files always first
        if (isConfig(a) && !isConfig(b))
            return -1;
        if (!isConfig(a) && isConfig(b))
            return 1;
        // Recently git-changed files next
        const aRecent = recentSet.has(a) ? 1 : 0;
        const bRecent = recentSet.has(b) ? 1 : 0;
        if (aRecent !== bRecent)
            return bRecent - aRecent;
        // Then by modification time (newest first)
        try {
            return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
        }
        catch {
            return a.localeCompare(b);
        }
    });
}
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
export function buildSourceContext(cwd, maxFiles = 50, maxTotalChars = 12000) {
    try {
        const lines = [];
        let budget = maxTotalChars;
        const append = (s) => {
            if (s.length + 2 <= budget) {
                lines.push(s);
                budget -= s.length + 1;
            }
        };
        // ── Project Metadata ──
        const pkg = loadConfigSummary(cwd, 'package.json');
        const tsConfig = loadConfigSummary(cwd, 'tsconfig.json');
        if (pkg || tsConfig) {
            append('--- PROJECT ---');
            if (pkg)
                append(pkg);
            if (tsConfig)
                append(tsConfig);
            append('');
        }
        // ── Git Context ──
        const recentGit = getRecentGitChanges(cwd);
        if (recentGit.length > 0) {
            append('--- RECENTLY CHANGED (git) ---');
            for (const f of recentGit)
                append(`  ${f}`);
            append('');
        }
        // ── File scan + prioritization ──
        const allFiles = listSourceFiles(cwd, maxFiles);
        if (allFiles.length === 0)
            return lines.join('\n').trim();
        const prioritized = prioritizeFiles(allFiles, cwd, recentGit);
        append('--- SOURCE FILES ---');
        append(`Directory: ${cwd}`);
        append('');
        for (const f of prioritized) {
            const display = path.relative(cwd, f);
            if (budget <= 50) {
                append(`  ... and ${allFiles.length - prioritized.indexOf(f)} more files`);
                break;
            }
            append(`  ${display}`);
        }
        append('');
        // ── Structural summaries for top files ──
        const summaryCount = Math.min(prioritized.length, 15);
        for (let i = 0; i < summaryCount && budget > 300; i++) {
            const f = prioritized[i];
            try {
                const content = fs.readFileSync(f, 'utf8');
                const rel = path.relative(cwd, f);
                const structure = extractStructure(content);
                if (structure) {
                    const header = `--- ${rel} ---`;
                    const block = `\n${header}\n${structure}\n`;
                    if (block.length < budget - 100) {
                        append(block);
                    }
                }
            }
            catch { /* skip unreadable */ }
        }
        // ── Footer ──
        const footer = '--- END WORKSPACE SOURCE ---';
        if (footer.length <= budget)
            append(footer);
        return lines.join('\n');
    }
    catch {
        return '';
    }
}
function listSourceFiles(dir, max) {
    const result = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
            if (result.length >= max)
                break;
            if (e.name.startsWith('.') || IGNORE_DIRS.has(e.name))
                continue;
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                result.push(...listSourceFiles(full, max - result.length));
            }
            else if (e.isFile()) {
                const ext = path.extname(e.name).toLowerCase();
                if (SOURCE_EXTENSIONS.has(ext)) {
                    result.push(full);
                }
            }
        }
    }
    catch { /* skip inaccessible */ }
    return result;
}
//# sourceMappingURL=utils.js.map