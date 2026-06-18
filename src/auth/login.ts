/**
 * aegis login — browser-based OAuth flow
 *
 * 1. Start a one-shot HTTP server on a random local port
 * 2. Open the browser to aegiscloud.org/login?redirect_uri=...
 * 3. Wait for the callback carrying ?token=...
 * 4. Persist the token in ~/.aegiscode/config.json
 * 5. Resolve (caller prints success) or reject with a readable error
 */

import * as http from 'node:http';
import * as fs   from 'node:fs';
import * as path from 'node:path';
import * as os   from 'node:os';
import { spawn }  from 'node:child_process';

const CONFIG_FILE      = path.join(os.homedir(), '.aegiscode', 'config.json');
const AEGISCLOUD_BASE  = 'https://aegiscloud.org';
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

// ── Colors ──────────────────────────────────────────────────────────────────
const C = {
  primary: '\x1b[38;2;0;229;192m',
  muted:   '\x1b[2m',
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  green:   '\x1b[32m',
};

// ── Open browser ─────────────────────────────────────────────────────────────
function openBrowser(url: string): void {
  // Linux: xdg-open; macOS: open; Windows: start
  const cmd =
    process.platform === 'darwin' ? 'open' :
    process.platform === 'win32'  ? 'cmd'  : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', url] : [url];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
}

// ── Persist token ────────────────────────────────────────────────────────────
function saveToken(token: string): void {
  let cfg: Record<string, any> = {};
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch {}

  cfg.aegiscloud = { ...(cfg.aegiscloud ?? {}), api_key: token };

  // Memory subscription tokens start with the same prefix — dual-save
  const isMemoryToken = /^[A-Za-z0-9_-]{20,}$/.test(token) && !token.startsWith('aegis_');
  if (isMemoryToken) {
    cfg.memory = {
      ...(cfg.memory ?? {}),
      token,
      subscribed: true,
      activatedAt: cfg.memory?.activatedAt ?? new Date().toISOString(),
      lastVerified: new Date().toISOString(),
      expiresAt: null,
    };
  }

  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

// ── Success page served to the browser ──────────────────────────────────────
const SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ÆGIS</title>
  <style>
    body { font-family: monospace; background: #0d1117; color: #00e5c0;
           display: flex; align-items: center; justify-content: center;
           height: 100vh; margin: 0; }
    .card { text-align: center; }
    h2 { font-size: 1.6rem; margin-bottom: .5rem; }
    p  { color: #888; }
  </style>
</head>
<body>
  <div class="card">
    <h2>◆ Logged in</h2>
    <p>You can close this tab and return to the terminal.</p>
  </div>
</body>
</html>`;

const ERROR_HTML = (msg: string) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>ÆGIS</title>
<style>body{font-family:monospace;background:#0d1117;color:#ff5555;
            display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}</style>
</head>
<body><h2>✗ ${msg}</h2></body>
</html>`;

// ── Main export ──────────────────────────────────────────────────────────────
export async function runLogin(): Promise<{ token: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      const callbackUrl = `http://127.0.0.1:${port}`;
      const loginUrl    = `${AEGISCLOUD_BASE}/auth/google?callback=${encodeURIComponent(callbackUrl)}`;

      let settled = false;

      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        server.close();
        if (err) reject(err);
      };

      const timer = setTimeout(
        () => done(new Error('Login timed out after 5 minutes. Please try again.')),
        LOGIN_TIMEOUT_MS,
      );

      server.on('request', (req, res) => {
        try {
          const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

          const token =
            url.searchParams.get('token') ??
            url.searchParams.get('api_key') ??
            url.searchParams.get('access_token');

          if (!token) {
            res.writeHead(400, { 'Content-Type': 'text/html' })
              .end(ERROR_HTML('No token received — please try again.'));
            done(new Error('No token in callback URL'));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html' }).end(SUCCESS_HTML);

          clearTimeout(timer);
          try {
            saveToken(token);
            done();
            resolve({ token });
          } catch (e) {
            done(e as Error);
          }
        } catch (e) {
          res.writeHead(500).end();
          done(e as Error);
        }
      });

      // ── Print prompt ───────────────────────────────────────────────────────
      process.stdout.write(
        `\n${C.primary}◆ ÆGIS — Login with Google${C.reset}\n\n` +
        `  Opening browser...\n\n` +
        `  ${C.muted}${loginUrl}${C.reset}\n\n` +
        `  ${C.muted}Paste this URL manually if the browser doesn't open.${C.reset}\n\n` +
        `  ${C.muted}Waiting for Google authentication… (Ctrl+Z to cancel)${C.reset}\n`,
      );

      openBrowser(loginUrl);
    });

    server.on('error', (err) => {
      reject(new Error(`Could not start local server: ${err.message}`));
    });
  });
}

// ── Username / password login ────────────────────────────────────────────────
export async function runLoginPassword(): Promise<void> {
  const { createInterface } = await import('node:readline');

  const ask = (prompt: string): Promise<string> =>
    new Promise(resolve => {
      process.stdout.write(prompt);
      const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
      rl.once('line', line => { rl.close(); resolve(line.trim()); });
    });

  const askHidden = (prompt: string): Promise<string> =>
    new Promise(resolve => {
      process.stdout.write(prompt);
      // Hide input by disabling echo
      if (process.stdin.isTTY) (process.stdin as any).setRawMode?.(true);
      let buf = '';
      const onData = (chunk: Buffer) => {
        for (const b of chunk) {
          if (b === 13 || b === 10) { // Enter
            process.stdout.write('\n');
            if (process.stdin.isTTY) (process.stdin as any).setRawMode?.(false);
            process.stdin.off('data', onData);
            process.stdin.pause();
            resolve(buf);
            return;
          } else if (b === 127 || b === 8) { // Backspace
            buf = buf.slice(0, -1);
          } else if (b >= 32) {
            buf += String.fromCharCode(b);
          }
        }
      };
      process.stdin.resume();
      process.stdin.on('data', onData);
    });

  process.stdout.write(`\n${C.primary}◆ ÆGIS — Login${C.reset}\n\n`);

  const username = await ask('  Username: ');
  if (!username) throw new Error('Username cannot be empty');

  const password = await askHidden('  Password: ');
  if (!password) throw new Error('Password cannot be empty');

  process.stdout.write(`\n  ${C.muted}Signing in…${C.reset}\n`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${AEGISCLOUD_BASE}/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
      signal:  controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json() as any;
    if (!data.success) throw new Error(data.error || 'Invalid credentials');
    if (data.api_key) saveToken(data.api_key);
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Request timed out — check your connection');
    throw e;
  }
}

// ── Claude Code Pro/Max subscription login ──────────────────────────────────
// Stores the OAuth token from `claude setup-token` (or pasted manually) into
// ~/.aegiscode/.env as CLAUDE_CODE_OAUTH_TOKEN, which ConfigManager picks up
// as an alternative credential for the currently configured Anthropic model —
// it does not change which model is selected.
const ENV_FILE = path.join(os.homedir(), '.aegiscode', '.env');

function saveClaudeCodeOAuthToken(token: string): void {
  let lines: string[] = [];
  try { lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n'); } catch {}

  const filtered = lines.filter(l => !l.startsWith('CLAUDE_CODE_OAUTH_TOKEN='));
  filtered.push(`CLAUDE_CODE_OAUTH_TOKEN=${token}`);

  const dir = path.dirname(ENV_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ENV_FILE, filtered.filter(l => l.trim()).join('\n') + '\n');
}

export async function runLoginClaudePro(): Promise<void> {
  process.stdout.write(
    `\n${C.primary}◆ ÆGIS — Login with Claude Code Pro / Max${C.reset}\n\n` +
    `  This uses your claude.ai subscription instead of a pay-per-token API key.\n` +
    `  Generate a token with: ${C.bold}claude setup-token${C.reset}\n\n`,
  );

  const { createInterface } = await import('node:readline');
  const token = await new Promise<string>(resolve => {
    process.stdout.write('  Paste the token here: ');
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
    rl.once('line', line => { rl.close(); resolve(line.trim()); });
  });

  if (!token) throw new Error('No token provided');
  if (!token.startsWith('sk-ant-oat')) {
    throw new Error('That doesn\'t look like a Claude Code OAuth token (expected it to start with "sk-ant-oat").');
  }

  saveClaudeCodeOAuthToken(token);
  process.stdout.write(`\n  ${C.green}✓ Saved.${C.reset} aegiscode will use your Claude Pro/Max subscription.\n\n`);
}

// ── Logout helper ─────────────────────────────────────────────────────────────
export function runLogout(): void {
  let cfg: Record<string, any> = {};
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch {}

  let hadOAuthToken = false;
  try {
    const lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n');
    hadOAuthToken = lines.some(l => l.startsWith('CLAUDE_CODE_OAUTH_TOKEN='));
    const filtered = lines.filter(l => !l.startsWith('CLAUDE_CODE_OAUTH_TOKEN='));
    fs.writeFileSync(ENV_FILE, filtered.filter(l => l.trim()).join('\n') + (filtered.some(l => l.trim()) ? '\n' : ''));
  } catch {}

  const hadKey = !!(cfg.aegiscloud?.api_key || cfg.memory?.token) || hadOAuthToken;

  if (cfg.aegiscloud) {
    delete cfg.aegiscloud.api_key;
    cfg.aegiscloud.syncConversations = false;
  }
  if (cfg.memory) {
    cfg.memory.subscribed  = false;
    cfg.memory.token       = undefined;
    cfg.memory.lastVerified = null;
  }

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
    process.stdout.write(
      hadKey
        ? `\n${C.green}✓ Logged out.${C.reset}\n\n`
        : `\n${C.muted}(no active session)${C.reset}\n\n`,
    );
  } catch (e) {
    process.stderr.write(`Failed to update config: ${(e as Error).message}\n`);
    process.exit(1);
  }
}
