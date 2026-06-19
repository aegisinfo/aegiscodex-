/**
 * AEGIS Memory Cloud Sync
 *
 * Pushes/pulls SharedMemory entries through aegiscloud.org so memory is
 * shared across devices (CLI + mobile) for subscribed users. Best-effort:
 * failures are swallowed, matching DriveSync's "silent fail — optional"
 * pattern. Never blocks the main session — callers fire-and-forget.
 */
import type { MemoryEntry } from './SharedMemory.js';
export declare function pushEntries(entries: MemoryEntry[], token: string): Promise<void>;
/** Returns true/false if the server could check, null if the request failed (caller should fail open). */
export declare function claimFreeTrial(fingerprint: string, sessionId: string): Promise<boolean | null>;
export declare function pullSince(since: string | null, token: string): Promise<MemoryEntry[]>;
/**
 * Keyword search against the caller's synced entries (catches entries written on
 * another device since the last `pullSince`). Caller is responsible for merging
 * with local results — this never throws, just returns [] on any failure.
 */
export declare function searchCloud(query: string, limit: number, token: string): Promise<MemoryEntry[]>;
//# sourceMappingURL=CloudSync.d.ts.map