/**
 * OllamaInstaller — auto-install, start, and validate Ollama when a local
 * Ollama model is selected.
 *
 * Flow:
 *  1. Detect if baseURL points to a local Ollama instance
 *  2. Ensure server is running (install if missing)
 *  3. Ensure the requested model is pulled
 *  4. Check that the model supports tools — auto-swap to llama3.2 if not
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

// ── Helpers ──────────────────────────────────────────────────────────────────

export function isLocalOllamaUrl(baseURL?: string): boolean {
  if (!baseURL) return false;
  return (
    baseURL.includes('localhost:11434') ||
    baseURL.includes('127.0.0.1:11434') ||
    baseURL.includes('0.0.0.0:11434')
  );
}

function log(msg: string): void {
  process.stderr.write(`\x1b[38;2;83;74;183m[Ollama]\x1b[0m ${msg}\n`);
}

async function isOllamaResponding(baseURL: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(baseURL.replace(/\/+$/, '') + '/api/tags', { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

function isBinaryInstalled(): boolean {
  try {
    execSync('which ollama', { stdio: 'ignore' });
    return true;
  } catch {
    try { execSync('test -x /usr/local/bin/ollama', { stdio: 'ignore' }); return true; } catch {}
    try { execSync('test -x /usr/bin/ollama', { stdio: 'ignore' }); return true; } catch {}
    return false;
  }
}

// ── Tool-support check ────────────────────────────────────────────────────────

async function modelSupportsTools(baseURL: string, model: string): Promise<boolean> {
  // 1. Try the Ollama /api/show capabilities field (Ollama ≥ 0.3.3)
  try {
    const res = await fetch(baseURL.replace(/\/+$/, '') + '/api/show', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model }),
    });
    if (res.ok) {
      const data = await res.json() as { capabilities?: string[] };
      if (Array.isArray(data.capabilities)) {
        return data.capabilities.includes('tools');
      }
    }
  } catch {
    // fall through to name heuristic
  }

  // 2. Name-based heuristic for older Ollama versions
  const tag = model.toLowerCase().replace(/^registry\.ollama\.ai\/library\//, '');
  return !TOOL_INCAPABLE_PATTERNS.some(re => re.test(tag));
}

// ── Install ───────────────────────────────────────────────────────────────────

async function installOllama(): Promise<boolean> {
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
      if (code === 0) { log('Ollama installed successfully.'); resolve(true); }
      else { log(`Install failed (exit ${code}). Try: curl -fsSL https://ollama.com/install.sh | sh`); resolve(false); }
    });
    child.on('error', (err) => { log(`Install error: ${err.message}`); resolve(false); });
  });
}

// ── Start server ─────────────────────────────────────────────────────────────

async function startOllamaServer(): Promise<boolean> {
  log('Starting Ollama server...');
  spawn('ollama', ['serve'], { stdio: 'ignore', detached: true }).unref();

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

async function getInstalledModels(baseURL: string): Promise<string[]> {
  try {
    const res = await fetch(baseURL.replace(/\/+$/, '') + '/api/tags');
    if (!res.ok) return [];
    const data = await res.json() as { models?: { name: string }[] };
    return (data.models || []).map(m => m.name);
  } catch {
    return [];
  }
}

async function pullModel(modelName: string): Promise<void> {
  const tag = modelName.replace(/^registry\.ollama\.ai\/library\//, '').split('/').pop() || modelName;
  log(`Pulling model "${tag}" (this may take a few minutes)...`);
  await new Promise<void>((resolve) => {
    const child = spawn('ollama', ['pull', tag], { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('close', (code) => {
      if (code === 0) log(`Model "${tag}" ready.`);
      else log(`Pull exited ${code} — run manually: ollama pull ${tag}`);
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
export async function ensureOllama(baseURL?: string, model?: string): Promise<string | undefined> {
  if (!isLocalOllamaUrl(baseURL)) return undefined;

  const base = baseURL!.replace(/\/+$/, '') || 'http://localhost:11434';

  // ── Ensure server is up ───────────────────────────────────────────────────
  if (!await isOllamaResponding(base)) {
    if (isBinaryInstalled()) {
      log('Ollama is installed but not running.');
      if (!await startOllamaServer()) return model;
    } else {
      log('Ollama not found.');
      if (!await installOllama()) return model;
      if (!await startOllamaServer()) return model;
    }
  }

  // ── Ensure model is pulled ────────────────────────────────────────────────
  const installedModels = await getInstalledModels(base);
  const requestedTag = (model || '').replace(/^registry\.ollama\.ai\/library\//, '');

  if (installedModels.length === 0) {
    const target = requestedTag || TOOLS_CAPABLE_FALLBACK;
    await pullModel(target);
  } else if (requestedTag) {
    const bare = requestedTag.split(':')[0];
    const exists = installedModels.some(m => m === requestedTag || m.startsWith(bare + ':') || m === bare);
    if (!exists) await pullModel(requestedTag);
  }

  // ── Check tool support ────────────────────────────────────────────────────
  const effectiveModel = requestedTag || TOOLS_CAPABLE_FALLBACK;
  const supportsTools = await modelSupportsTools(base, effectiveModel);

  if (!supportsTools) {
    log(`"${effectiveModel}" does not support tools. Switching to ${TOOLS_CAPABLE_FALLBACK}.`);

    // Pull the fallback if needed
    const bare = TOOLS_CAPABLE_FALLBACK.split(':')[0];
    const freshModels = await getInstalledModels(base);
    const fallbackExists = freshModels.some(m => m === TOOLS_CAPABLE_FALLBACK || m.startsWith(bare + ':') || m === bare);
    if (!fallbackExists) await pullModel(TOOLS_CAPABLE_FALLBACK);

    return TOOLS_CAPABLE_FALLBACK;
  }

  return effectiveModel || model;
}
