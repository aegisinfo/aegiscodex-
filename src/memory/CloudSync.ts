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

// Embeddings are 384 floats — as JSON that's ~7KB per entry. The server only
// ever does keyword (LIKE) search/dashboard listing on memory_entries, never
// vector similarity, so transmitting them bloats every push for zero server-side
// benefit. A bulk upload of a few thousand entries turned tens of MB of pure
// embedding JSON across many sequential requests, which is what was actually
// timing out — not a network problem. Dropping it: a device that pulls this
// entry down just lacks a precomputed vector locally (falls back to keyword
// search for it, same as any entry whose embedder failed at add()-time).
function stripEmbedding(entries: MemoryEntry[]): Omit<MemoryEntry, 'embedding'>[] {
  return entries.map(({ embedding, ...rest }) => rest);
}

export async function pushEntries(entries: MemoryEntry[], token: string): Promise<void> {
  if (entries.length === 0) return;
  try {
    await fetch(`${MEMORY_API_BASE}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ entries: stripEmbedding(entries) }),
    });
  } catch {
    // silent fail — sync is optional, local memory already has the entry
  }
}

/** Like pushEntries, but reports how many entries the server actually saved (for bulk uploads). */
export async function pushBatch(entries: MemoryEntry[], token: string): Promise<number> {
  if (entries.length === 0) return 0;
  try {
    // A bulk upload can be many sequential batches — one slow/hung request
    // without its own timeout would stall the whole pushAll() loop indefinitely,
    // regardless of any timeout the caller process is given from outside.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    let res: Response;
    try {
      res = await fetch(`${MEMORY_API_BASE}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ entries: stripEmbedding(entries) }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return 0;
    const data = await res.json() as { saved?: number };
    return data.saved ?? 0;
  } catch {
    return 0;
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
