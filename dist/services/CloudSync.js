/**
 * CloudSync - Laddar upp konversationer till aegiscloud.org
 *
 * Körs automatiskt vid exit om aegiscloud.api_key är satt i config.
 * Kräver att aegiscloud.org/api/conversations är uppe och tar emot POST.
 *
 * Config (~/.aegiscode/config.json):
 * {
 *   "aegiscloud": {
 *     "api_key": "...",
 *     "syncConversations": true
 *   }
 * }
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
export async function syncConversation(sessionId, messages, model) {
    // Läs config
    let cfg = {};
    try {
        const cfgPath = path.join(os.homedir(), '.aegiscode', 'config.json');
        cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    }
    catch {
        return { ok: false, reason: 'no_key' };
    }
    const apiKey = cfg?.aegiscloud?.api_key;
    const doSync = cfg?.aegiscloud?.syncConversations !== false; // default true om key finns
    if (!apiKey)
        return { ok: false, reason: 'no_key' };
    if (!doSync)
        return { ok: false, reason: 'disabled' };
    if (!messages || messages.length === 0)
        return { ok: false, reason: 'empty' };
    const payload = JSON.stringify({
        session_id: sessionId,
        model: model ?? 'unknown',
        messages: messages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
        timestamp: new Date().toISOString(),
    });
    // Signera med användarens egna API-nyckel (per-user HMAC)
    const timestamp = String(Math.floor(Date.now() / 1000));
    let signature = '';
    try {
        const { createHmac } = await import('crypto');
        signature = createHmac('sha256', apiKey)
            .update(`${timestamp}:${payload}`)
            .digest('hex');
    }
    catch { }
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'aegiscloud.org',
            path: '/api/conversations/cli-sync',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey,
                'X-AEGIS-Timestamp': timestamp,
                'X-AEGIS-Signature': signature,
                'Content-Length': Buffer.byteLength(payload),
            },
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode < 300) {
                    resolve({ ok: true, reason: 'uploaded' });
                }
                else {
                    resolve({ ok: false, reason: 'error', error: `HTTP ${res.statusCode}: ${body.slice(0, 120)}` });
                }
            });
        });
        req.on('error', (err) => resolve({ ok: false, reason: 'error', error: err.message }));
        req.setTimeout(5000, () => { req.destroy(); resolve({ ok: false, reason: 'error', error: 'timeout' }); });
        req.write(payload);
        req.end();
    });
}
/** Spara API-nyckel i config */
export function saveAegisCloudKey(apiKey, syncConversations = true) {
    const cfgPath = path.join(os.homedir(), '.aegiscode', 'config.json');
    let cfg = {};
    try {
        cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    }
    catch { }
    cfg.aegiscloud = { ...cfg.aegiscloud, api_key: apiKey, syncConversations };
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
}
/** Läs aegiscloud-config */
export function getAegisCloudConfig() {
    try {
        const cfgPath = path.join(os.homedir(), '.aegiscode', 'config.json');
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        return {
            apiKey: cfg?.aegiscloud?.api_key,
            syncConversations: cfg?.aegiscloud?.syncConversations !== false,
        };
    }
    catch {
        return { syncConversations: false };
    }
}
/** Spara konversation till lokal shared.json memory */
export async function appendToLocalMemory(sessionId, messages) {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const memFile = path.join(os.homedir(), '.aegiscode', 'memory', 'shared.json');
    let entries = [];
    try {
        const raw = fs.readFileSync(memFile, 'utf8');
        entries = JSON.parse(raw);
    }
    catch { }
    const now = new Date().toISOString();
    for (const m of messages) {
        if (!m.content || m.role === 'system')
            continue;
        entries.push({
            id: String(Date.now() + Math.random()),
            timestamp: now,
            source: 'aegis-cli',
            tags: ['aegis', m.role],
            content: typeof m.content === 'string'
                ? m.content.slice(0, 500)
                : JSON.stringify(m.content).slice(0, 500),
            session: sessionId,
        });
    }
    try {
        fs.mkdirSync(path.dirname(memFile), { recursive: true });
        fs.writeFileSync(memFile, JSON.stringify(entries, null, 2));
    }
    catch { }
}
//# sourceMappingURL=CloudSync.js.map