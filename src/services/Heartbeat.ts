/**
 * Heartbeat — lightweight online-status ping to aegiscloud.org
 *
 * Fires every 2 minutes while the CLI is running so the admin dashboard
 * shows idle-but-logged-in users as active, not just users making API calls.
 *
 * Fire-and-forget, never blocks the UI. Silently swallows all errors.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as https from 'node:https';

const HEARTBEAT_URL = '/api/heartbeat';
const HOST = 'aegiscloud.org';
const INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/** Read aegiscloud API key from config */
function getApiKey(): string | null {
  try {
    const cfgPath = path.join(os.homedir(), '.aegiscode', 'config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return cfg?.aegiscloud?.api_key ?? null;
  } catch {
    return null;
  }
}

/** Send one heartbeat — fire-and-forget, silent on failure */
function sendHeartbeat(): void {
  const apiKey = getApiKey();
  if (!apiKey) return;

  const payload = JSON.stringify({ ts: Date.now() });

  const req = https.request(
    {
      hostname: HOST,
      path: HEARTBEAT_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'Content-Length': Buffer.byteLength(payload),
      },
    },
    (res) => {
      // Drain response to avoid lingering connections
      res.resume();
    },
  );

  req.on('error', () => {
    // silent — heartbeat is optional
  });
  req.setTimeout(5000, () => {
    req.destroy();
  });
  req.write(payload);
  req.end();
}

/** Start the heartbeat timer. Safe to call multiple times — only starts once. */
export function startHeartbeat(): void {
  if (intervalHandle) return;
  // Send one immediately so the dashboard sees the user right away
  sendHeartbeat();
  intervalHandle = setInterval(sendHeartbeat, INTERVAL_MS);
  // Allow the process to exit without waiting for the timer
  if (intervalHandle && typeof intervalHandle === 'object' && 'unref' in intervalHandle) {
    intervalHandle.unref();
  }
}

/** Stop the heartbeat timer */
export function stopHeartbeat(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
