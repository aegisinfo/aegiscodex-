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
    teal: '\x1b[38;2;0;229;192m',
    purple: '\x1b[38;2;124;111;212m',
    green: '\x1b[38;2;34;197;94m',
    red: '\x1b[38;2;239;68;68m',
    muted: '\x1b[38;2;68;64;90m',
    bold: '\x1b[1m',
    reset: '\x1b[0m',
};
function getConfig() {
    try {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
    catch {
        return {};
    }
}
function saveConfig(cfg) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}
export async function runGmail(args) {
    const W = process.stdout.columns || 80;
    const line = '─'.repeat(W);
    const cmd = args.trim().toLowerCase();
    const cfg = getConfig();
    // Status
    if (!cmd || cmd === 'status') {
        console.log(`\n${C.teal}${line}${C.reset}`);
        console.log(`${C.teal}${C.bold}  Gmail Integration${C.reset}`);
        console.log(`${C.teal}${line}${C.reset}\n`);
        if (cfg.gmail?.connected) {
            console.log(`  ${C.green}✓ Connected${C.reset}  ${C.muted}${cfg.gmail.email}${C.reset}`);
            console.log(`  ${C.muted}Conversations saved to Gmail label: AEGIS${C.reset}\n`);
            console.log(`  /connect gmail disconnect  — remove Gmail access`);
        }
        else {
            console.log(`  ${C.muted}Not connected${C.reset}\n`);
            console.log(`  ${C.teal}What you get:${C.reset}`);
            console.log(`  ${C.muted}• Conversations saved to Gmail as searchable threads${C.reset}`);
            console.log(`  ${C.muted}• Access your AEGIS history from any device${C.reset}`);
            console.log(`  ${C.muted}• Gmail search: label:AEGIS${C.reset}\n`);
            console.log(`  /connect gmail connect  — link your Gmail`);
        }
        console.log(`\n${C.muted}${line}${C.reset}\n`);
        return;
    }
    // Connect
    if (cmd === 'connect') {
        const authUrl = 'https://aegiscloud.org/auth/google?scope=gmail&redirect=cli';
        console.log(`\n  ${C.teal}Opening Gmail authorization...${C.reset}`);
        console.log(`  ${C.muted}${authUrl}${C.reset}\n`);
        exec(`xdg-open "${authUrl}"`, () => { });
        // Start local callback server
        console.log(`  ${C.muted}Waiting for authorization...${C.reset}`);
        const token = await waitForCallback();
        if (token) {
            cfg.gmail = { connected: true, token, email: token.email || 'connected' };
            saveConfig(cfg);
            console.log(`\n  ${C.green}✓ Gmail connected!${C.reset}`);
            console.log(`  ${C.muted}Conversations will be saved to Gmail label: AEGIS${C.reset}\n`);
        }
        else {
            console.log(`\n  ${C.red}Authorization failed or timed out${C.reset}\n`);
        }
        return;
    }
    // Disconnect
    if (cmd === 'disconnect') {
        delete cfg.gmail;
        saveConfig(cfg);
        console.log(`\n  ${C.muted}Gmail disconnected${C.reset}\n`);
        return;
    }
}
function waitForCallback() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const url = new URL(req.url || '/', 'http://localhost:9876');
            if (url.pathname === '/callback') {
                const token = url.searchParams.get('token');
                const email = url.searchParams.get('email');
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('<html><body><h2>✓ AEGIS Gmail connected!</h2><p>You can close this tab.</p></body></html>');
                server.close();
                resolve(token ? { token, email } : null);
            }
        });
        server.listen(9876, () => { });
        setTimeout(() => { server.close(); resolve(null); }, 120000);
    });
}
//# sourceMappingURL=gmail.js.map