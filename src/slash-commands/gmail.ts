/**
 * /connect gmail — Link Gmail to AEGIS conversations
 * Saves conversations as Gmail labels/threads
 */
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';

const CONFIG_PATH = path.join(os.homedir(), '.aegiscode', 'config.json');
const C = {
  teal:   '\x1b[38;2;0;229;192m',
  purple: '\x1b[38;2;124;111;212m',
  green:  '\x1b[38;2;34;197;94m',
  red:    '\x1b[38;2;239;68;68m',
  muted:  '\x1b[38;2;68;64;90m',
  bold:   '\x1b[1m',
  reset:  '\x1b[0m',
};

function getConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch { return {}; }
}

function saveConfig(cfg: any) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

export async function runGmail(args: string) {
  const W = process.stdout.columns || 80;
  const line = '─'.repeat(W);
  const cmd = args.trim().toLowerCase();
  const cfg = getConfig();

  // Status
  if (!cmd || cmd === 'status') {

    if (cfg.gmail?.connected) {

    } else {

    }
    return;
  }

  // Connect
  if (cmd === 'connect') {
    const authUrl = 'https://aegiscloud.org/auth/google?scope=gmail&redirect=cli';

    exec(`xdg-open "${authUrl}"`, () => {});

    // Start local callback server
    const token = await waitForCallback();
    if (token) {
      cfg.gmail = { connected: true, token, email: token.email || 'connected' };
      saveConfig(cfg);

    } else {
    }
    return;
  }

  // Disconnect
  if (cmd === 'disconnect') {
    delete cfg.gmail;
    saveConfig(cfg);
    return;
  }
}

function waitForCallback(): Promise<any> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://localhost:9876');
      if (url.pathname === '/callback') {
        const token = url.searchParams.get('token');
        const email = url.searchParams.get('email');
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end('<html><body><h2>✓ AEGIS Gmail connected!</h2><p>You can close this tab.</p></body></html>');
        server.close();
        resolve(token ? { token, email } : null);
      }
    });
    server.listen(9876, () => {});
    setTimeout(() => { server.close(); resolve(null); }, 120000);
  });
}
