/**
 * OllamaInstaller — auto-install, start, and validate Ollama when a local
 * Ollama model is selected.
 *
 * Flow:
 *  1. Detect if baseURL points to a local Ollama instance
 *  2. Ensure server is running (install if missing)
 *  3. Ensure the requested model is pulled
 *  4. Check that the model supports tools — auto-swap to best installed capable model if not
 *  5. Return the final model name to use (may differ from the input)
 */
import { execSync, spawn } from 'child_process';
import { platform } from 'os';
const POLL_INTERVAL_MS = 600;
const START_TIMEOUT_MS = 15_000;
const TOOLS_CAPABLE_FALLBACK = 'llama3.2';
// Models confirmed to NOT support tools in Ollama.
// llama3.1 / llama3.2 / llama3.3 DO support tools; bare "llama3" does not.
const TOOL_INCAPABLE_PATTERNS = [
    /^llama3$/,
    /^llama3:latest$/,
    /^llama2(:|$)/,
    /^codellama(:|$)/,
    /^phi[23](:|$)/,
    /^gemma(:|$)/,
    /^gemma2(:|$)/,
    /^orca-mini(:|$)/,
    /^vicuna(:|$)/,
];
// ── Session cache ─────────────────────────────────────────────────────────────
// Keyed by model name. isLoaded is always fetched fresh (changes at runtime);
// supportsTools and sizeGB are stable per model and cached after first fetch.
const detailsCache = new Map();
// ── Helpers ──────────────────────────────────────────────────────────────────
export function isLocalOllamaUrl(baseURL) {
    if (!baseURL)
        return false;
    return (baseURL.includes('localhost:11434') ||
        baseURL.includes('127.0.0.1:11434') ||
        baseURL.includes('0.0.0.0:11434'));
}
// Strip /v1 (OpenAI-compat path) to get the Ollama server root for management APIs
function ollamaRoot(baseURL) {
    return baseURL.replace(/\/v1\/?$/, '').replace(/\/+$/, '');
}
function log(msg) {
    process.stderr.write(`\x1b[38;2;83;74;183m[Ollama]\x1b[0m ${msg}\n`);
}
function nameMatchesBare(installed, bare) {
    return installed === bare || installed.startsWith(bare + ':') || installed === bare + ':latest';
}
async function isOllamaResponding(baseURL) {
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2000);
        const res = await fetch(ollamaRoot(baseURL) + '/api/tags', { signal: ctrl.signal });
        clearTimeout(timer);
        return res.ok;
    }
    catch {
        return false;
    }
}
function isBinaryInstalled() {
    try {
        execSync('which ollama', { stdio: 'ignore' });
        return true;
    }
    catch { }
    try {
        execSync('ollama --version', { stdio: 'ignore' });
        return true;
    }
    catch { }
    const paths = [
        '/usr/local/bin/ollama',
        '/usr/bin/ollama',
        `${process.env.HOME}/.local/bin/ollama`,
        `${process.env.HOME}/bin/ollama`,
    ];
    for (const p of paths) {
        try {
            execSync(`test -x "${p}"`, { stdio: 'ignore' });
            return true;
        }
        catch { }
    }
    return false;
}
// ── Model info fetchers ───────────────────────────────────────────────────────
// /api/show — capabilities + disk size. Results cached per model name.
async function fetchModelDetails(base, model) {
    const cached = detailsCache.get(model);
    if (cached)
        return cached;
    try {
        const res = await fetch(base + '/api/show', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: model }),
        });
        if (res.ok) {
            const data = await res.json();
            const supportsTools = Array.isArray(data.capabilities)
                ? data.capabilities.includes('tools')
                : !TOOL_INCAPABLE_PATTERNS.some(re => re.test(model.toLowerCase().replace(/^registry\.ollama\.ai\/library\//, '')));
            const sizeGB = typeof data.size === 'number' && data.size > 0
                ? Math.round(data.size / 1e8) / 10 // round to 1 decimal GB
                : undefined;
            const result = { supportsTools, sizeGB };
            detailsCache.set(model, result);
            return result;
        }
    }
    catch { }
    // Fallback: name heuristic only
    const tag = model.toLowerCase().replace(/^registry\.ollama\.ai\/library\//, '');
    const result = { supportsTools: !TOOL_INCAPABLE_PATTERNS.some(re => re.test(tag)) };
    detailsCache.set(model, result);
    return result;
}
// /api/tags — all installed models with their disk sizes
async function getInstalledModels(base) {
    try {
        const res = await fetch(base + '/api/tags');
        if (!res.ok)
            return [];
        const data = await res.json();
        return (data.models || []).map(m => ({ name: m.name, size: m.size ?? 0 }));
    }
    catch {
        return [];
    }
}
// /api/ps — models currently loaded in memory (respond instantly, no cold-start)
async function getLoadedModels(base) {
    try {
        const res = await fetch(base + '/api/ps');
        if (!res.ok)
            return [];
        const data = await res.json();
        return (data.models || []).map(m => m.name);
    }
    catch {
        return [];
    }
}
// ── Public: enriched model list ───────────────────────────────────────────────
/**
 * Returns enriched info for every model installed in a local Ollama instance.
 * Used by the /model selector to show size, tool support, and loaded status.
 * Returns [] if baseURL is not a local Ollama URL or the server is not running.
 */
export async function getOllamaModels(baseURL) {
    if (!isLocalOllamaUrl(baseURL))
        return [];
    const base = ollamaRoot(baseURL);
    if (!await isOllamaResponding(base))
        return [];
    const [installed, loadedNames] = await Promise.all([
        getInstalledModels(base),
        getLoadedModels(base),
    ]);
    const loadedSet = new Set(loadedNames.map(n => n.split(':')[0]));
    return Promise.all(installed.map(async ({ name, size }) => {
        const details = await fetchModelDetails(base, name);
        // Use size from /api/tags if /api/show didn't return it
        const sizeGB = details.sizeGB ?? (size > 0 ? Math.round(size / 1e8) / 10 : undefined);
        const isLoaded = loadedSet.has(name.split(':')[0]);
        return { name, supportsTools: details.supportsTools, sizeGB, isLoaded };
    }));
}
// ── Install ───────────────────────────────────────────────────────────────────
async function installOllama() {
    if (isBinaryInstalled()) {
        log('Ollama is already installed.');
        return true;
    }
    if (platform() === 'win32') {
        log('Auto-install not supported on Windows. Download from https://ollama.com/download');
        return false;
    }
    log('Installing Ollama...');
    return new Promise((resolve) => {
        const child = spawn('sh', ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'], {
            stdio: ['ignore', 'inherit', 'inherit'],
        });
        child.on('close', (code) => {
            if (code === 0) {
                log('Ollama installed successfully.');
                resolve(true);
            }
            else {
                log(`Install failed (exit ${code}). Try: curl -fsSL https://ollama.com/install.sh | sh`);
                resolve(false);
            }
        });
        child.on('error', (err) => { log(`Install error: ${err.message}`); resolve(false); });
    });
}
// ── Start server ─────────────────────────────────────────────────────────────
async function startOllamaServer() {
    log('Starting Ollama server...');
    try {
        spawn('ollama', ['serve'], { stdio: 'ignore', detached: true })
            .on('error', () => { })
            .unref();
    }
    catch {
        return false;
    }
    const deadline = Date.now() + START_TIMEOUT_MS;
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        if (await isOllamaResponding('http://localhost:11434')) {
            log('Ollama server is up.');
            return true;
        }
    }
    log('Ollama server did not respond in time. Try: ollama serve');
    return false;
}
// ── Model pull ────────────────────────────────────────────────────────────────
async function pullModel(modelName) {
    const tag = modelName.replace(/^registry\.ollama\.ai\/library\//, '').split('/').pop() || modelName;
    log(`Pulling model "${tag}" (this may take a few minutes)...`);
    await new Promise((resolve) => {
        const child = spawn('ollama', ['pull', tag], { stdio: ['ignore', 'inherit', 'inherit'] });
        child.on('close', (code) => {
            if (code === 0)
                log(`Model "${tag}" ready.`);
            else
                log(`Pull exited ${code} — run manually: ollama pull ${tag}`);
            resolve();
        });
        child.on('error', () => resolve());
    });
}
// ── Public entry point ────────────────────────────────────────────────────────
/**
 * Called by Agent.initialize() before the first API request.
 *
 * Returns the model name that should actually be used — this may differ from
 * the `model` argument when the requested model does not support tools and
 * has been swapped for a capable alternative.
 *
 * Returns undefined if baseURL is not a local Ollama endpoint (no-op).
 */
export async function ensureOllama(baseURL, model) {
    if (!isLocalOllamaUrl(baseURL))
        return undefined;
    const base = ollamaRoot(baseURL) || 'http://localhost:11434';
    // ── Ensure server is up ───────────────────────────────────────────────────
    if (!await isOllamaResponding(base)) {
        if (isBinaryInstalled()) {
            log('Ollama is installed but not running.');
            if (!await startOllamaServer())
                return model;
        }
        else {
            log('Ollama not found.');
            if (!await installOllama())
                return model;
            if (!await startOllamaServer())
                return model;
        }
    }
    // ── Ensure model is pulled ────────────────────────────────────────────────
    const installed = await getInstalledModels(base);
    const installedNames = installed.map(m => m.name);
    const requestedTag = (model || '').replace(/^registry\.ollama\.ai\/library\//, '');
    if (installedNames.length === 0) {
        await pullModel(requestedTag || TOOLS_CAPABLE_FALLBACK);
    }
    else if (requestedTag) {
        const bare = requestedTag.split(':')[0];
        const exists = installedNames.some(m => nameMatchesBare(m, bare) || m === requestedTag);
        if (!exists)
            await pullModel(requestedTag);
    }
    // ── Check tool support ────────────────────────────────────────────────────
    const effectiveModel = requestedTag || TOOLS_CAPABLE_FALLBACK;
    const { supportsTools } = await fetchModelDetails(base, effectiveModel);
    if (!supportsTools) {
        // Prefer an already-installed tool-capable model over pulling a new one
        const freshInstalled = await getInstalledModels(base);
        const capableFallback = await findBestInstalledCapableModel(base, freshInstalled.map(m => m.name));
        if (capableFallback) {
            log(`"${effectiveModel}" does not support tools. Switching to installed model "${capableFallback}".`);
            return capableFallback;
        }
        // Nothing capable installed — pull the default fallback
        log(`"${effectiveModel}" does not support tools. Pulling ${TOOLS_CAPABLE_FALLBACK}...`);
        await pullModel(TOOLS_CAPABLE_FALLBACK);
        return TOOLS_CAPABLE_FALLBACK;
    }
    return effectiveModel || model;
}
// Find the best already-installed model that supports tools.
// Prefers loaded models, then prefers well-known capable models.
async function findBestInstalledCapableModel(base, names) {
    const loadedNames = await getLoadedModels(base);
    const loadedSet = new Set(loadedNames.map(n => n.split(':')[0]));
    const capable = [];
    for (const name of names) {
        const { supportsTools } = await fetchModelDetails(base, name);
        if (supportsTools)
            capable.push(name);
    }
    if (capable.length === 0)
        return undefined;
    // Prefer a currently loaded model
    const loadedCapable = capable.find(n => loadedSet.has(n.split(':')[0]));
    if (loadedCapable)
        return loadedCapable;
    return capable[0];
}
//# sourceMappingURL=OllamaInstaller.js.map