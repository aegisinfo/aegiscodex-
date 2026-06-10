/**
 * OllamaInstaller — auto-install and start Ollama when an Ollama model is selected.
 *
 * Flow:
 *  1. Detect if the configured baseURL points to a local Ollama instance
 *  2. Check if Ollama is already responding
 *  3. If not: check if the binary exists → start it
 *  4. If binary missing: run the platform install script, then start
 *  5. Pull a default model if none are available
 */

import { execSync, spawn } from 'child_process';
import { platform } from 'os';

const POLL_INTERVAL_MS = 600;
const START_TIMEOUT_MS = 15_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function isLocalOllamaUrl(baseURL?: string): boolean {
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
    const url = baseURL.replace(/\/+$/, '') + '/api/tags';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(url, { signal: ctrl.signal });
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
    // also try common paths
    try { execSync('test -x /usr/local/bin/ollama', { stdio: 'ignore' }); return true; } catch {}
    try { execSync('test -x /usr/bin/ollama', { stdio: 'ignore' }); return true; } catch {}
    return false;
  }
}

// ── Install ───────────────────────────────────────────────────────────────────

async function installOllama(): Promise<boolean> {
  const os = platform();

  if (os === 'win32') {
    log('Auto-install not supported on Windows. Download from https://ollama.com/download');
    return false;
  }

  log('Installing Ollama...');

  return new Promise((resolve) => {
    // Official install script works for Linux + macOS
    const child = spawn(
      'sh',
      ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'],
      { stdio: ['ignore', 'inherit', 'inherit'] }
    );

    child.on('close', (code) => {
      if (code === 0) {
        log('Ollama installed successfully.');
        resolve(true);
      } else {
        log(`Install script exited with code ${code}. Try manually: curl -fsSL https://ollama.com/install.sh | sh`);
        resolve(false);
      }
    });

    child.on('error', (err) => {
      log(`Install failed: ${err.message}`);
      resolve(false);
    });
  });
}

// ── Start server ─────────────────────────────────────────────────────────────

async function startOllamaServer(): Promise<boolean> {
  log('Starting Ollama server...');

  spawn('ollama', ['serve'], {
    stdio: 'ignore',
    detached: true,
  }).unref();

  // Poll until it responds or timeout
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    if (await isOllamaResponding('http://localhost:11434')) {
      log('Ollama server is up.');
      return true;
    }
  }

  log('Ollama server did not respond in time. Check: ollama serve');
  return false;
}

// ── Model pull ────────────────────────────────────────────────────────────────

async function getInstalledModels(baseURL: string): Promise<string[]> {
  try {
    const url = baseURL.replace(/\/+$/, '') + '/api/tags';
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json() as { models?: { name: string }[] };
    return (data.models || []).map(m => m.name);
  } catch {
    return [];
  }
}

async function pullModel(modelName: string): Promise<void> {
  // Strip any path prefix that looks like an Ollama model tag
  const tag = modelName.split('/').pop() || modelName;
  log(`Pulling model "${tag}" (this may take a few minutes)...`);

  await new Promise<void>((resolve) => {
    const child = spawn('ollama', ['pull', tag], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('close', (code) => {
      if (code === 0) log(`Model "${tag}" ready.`);
      else log(`Pull exited with code ${code} — you can run: ollama pull ${tag}`);
      resolve();
    });
    child.on('error', () => resolve());
  });
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Called by Agent.initialize() before the first API request.
 * No-ops immediately if the baseURL is not a local Ollama endpoint.
 */
export async function ensureOllama(baseURL?: string, model?: string): Promise<void> {
  if (!isLocalOllamaUrl(baseURL)) return;

  const base = baseURL!.replace(/\/+$/, '') || 'http://localhost:11434';

  // Already up — nothing to do
  if (await isOllamaResponding(base)) {
    const models = await getInstalledModels(base);
    if (models.length === 0 && model) {
      await pullModel(model);
    }
    return;
  }

  // Binary present but server not running
  if (isBinaryInstalled()) {
    log('Ollama is installed but not running.');
    const started = await startOllamaServer();
    if (!started) return;
  } else {
    // Need to install from scratch
    log('Ollama not found.');
    const installed = await installOllama();
    if (!installed) return;
    const started = await startOllamaServer();
    if (!started) return;
  }

  // Ensure the requested model exists
  const models = await getInstalledModels(base);
  if (models.length === 0) {
    const target = model || 'llama3.2';
    await pullModel(target);
  } else if (model) {
    const tag = model.split('/').pop() || model;
    const exists = models.some(m => m === tag || m.startsWith(tag + ':'));
    if (!exists) await pullModel(model);
  }
}
