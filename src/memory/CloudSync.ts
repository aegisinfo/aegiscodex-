/**
 * AEGIS Memory Cloud Sync
 *
 * Pushes/pulls SharedMemory entries through aegiscloud.org so memory is
 * shared across devices (CLI + mobile) for subscribed users. Best-effort:
 * failures are swallowed, matching DriveSync's "silent fail — optional"
 * pattern. Never blocks the main session — callers fire-and-forget.
 */
import type { MemoryEntry } from './SharedMemory.js';

const MEMORY_API_BASE = process.env.AEGIS_MEMORY_API_BASE || 'https://aegiscloud.org/api/memory';

export async function pushEntries(entries: MemoryEntry[], token: string): Promise<void> {
  if (entries.length === 0) return;
  try {
    await fetch(`${MEMORY_API_BASE}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ entries }),
    });
  } catch {
    // silent fail — sync is optional, local memory already has the entry
  }
}

/** Returns true/false if the server could check, null if the request failed (caller should fail open). */
export async function claimFreeTrial(fingerprint: string, sessionId: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${MEMORY_API_BASE}/claim-free-trial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint, sessionId }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { allowed?: boolean };
    return typeof data.allowed === 'boolean' ? data.allowed : null;
  } catch {
    return null;
  }
}

export async function pullSince(since: string | null, token: string): Promise<MemoryEntry[]> {
  try {
    const res = await fetch(`${MEMORY_API_BASE}/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(since ? { since } : {}),
    });
    if (!res.ok) return [];
    const data = await res.json() as { entries?: MemoryEntry[] };
    return data.entries ?? [];
  } catch {
    return [];
  }
}

/**
 * Keyword search against the caller's synced entries (catches entries written on
 * another device since the last `pullSince`). Caller is responsible for merging
 * with local results — this never throws, just returns [] on any failure.
 */
export async function searchCloud(query: string, limit: number, token: string): Promise<MemoryEntry[]> {
  try {
    const res = await fetch(`${MEMORY_API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ query, limit }),
    });
    if (!res.ok) return [];
    const data = await res.json() as { entries?: MemoryEntry[] };
    return data.entries ?? [];
  } catch {
    return [];
  }
}
