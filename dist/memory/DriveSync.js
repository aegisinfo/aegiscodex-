/**
 * AEGIS Drive Sync
 * Uploads conversation sessions to user's Google Drive
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
const CONFIG_PATH = path.join(os.homedir(), '.aegiscode', 'config.json');
const SESSIONS_DIR = path.join(os.homedir(), '.aegis', 'projects');
function getConfig() {
    try {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
    catch {
        return {};
    }
}
async function getDriveToken() {
    const cfg = getConfig();
    const apiKey = cfg?.aegiscloud?.api_key || process.env.AEGISCLOUD_API_KEY;
    if (!apiKey)
        return null;
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'aegiscloud.org',
            path: '/api/drive/token',
            method: 'GET',
            headers: { 'X-API-Key': apiKey }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const d = JSON.parse(data);
                    resolve(d.connected ? d.access_token : null);
                }
                catch {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.end();
    });
}
async function uploadToDrive(token, filename, content) {
    return new Promise((resolve, reject) => {
        const boundary = '-------aegis_boundary';
        const metadata = JSON.stringify({ name: filename, parents: ['root'] });
        const body = [
            `--${boundary}`,
            'Content-Type: application/json; charset=UTF-8',
            '',
            metadata,
            `--${boundary}`,
            'Content-Type: text/plain',
            '',
            content,
            `--${boundary}--`,
        ].join('\r\n');
        const req = https.request({
            hostname: 'www.googleapis.com',
            path: '/upload/drive/v3/files?uploadType=multipart',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
                'Content-Length': Buffer.byteLength(body),
            }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode === 200 || res.statusCode === 201)
                    resolve();
                else
                    reject(new Error(`Drive upload failed: ${res.statusCode}`));
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}
export async function syncSessionToDrive(sessionId) {
    const token = await getDriveToken();
    if (!token)
        return;
    // Find session file
    const projects = fs.readdirSync(SESSIONS_DIR).filter(d => fs.statSync(path.join(SESSIONS_DIR, d)).isDirectory());
    for (const project of projects) {
        const sessionFile = path.join(SESSIONS_DIR, project, `${sessionId}.jsonl`);
        if (fs.existsSync(sessionFile)) {
            const content = fs.readFileSync(sessionFile, 'utf8');
            const filename = `AEGIS/${project}/${sessionId}.jsonl`;
            try {
                await uploadToDrive(token, filename, content);
                console.log(`\x1b[38;2;68;64;90m[Drive] Synced ${sessionId}\x1b[0m`);
            }
            catch (e) {
                // Silent fail — Drive sync is optional
            }
            return;
        }
    }
}
//# sourceMappingURL=DriveSync.js.map