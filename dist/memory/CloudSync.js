const MEMORY_API_BASE = process.env.AEGIS_MEMORY_API_BASE || 'https://aegiscloud.org/api/memory';
export async function pushEntries(entries, token) {
    if (entries.length === 0)
        return;
    try {
        await fetch(`${MEMORY_API_BASE}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ entries }),
        });
    }
    catch {
        // silent fail — sync is optional, local memory already has the entry
    }
}
/** Returns true/false if the server could check, null if the request failed (caller should fail open). */
export async function claimFreeTrial(fingerprint, sessionId) {
    try {
        const res = await fetch(`${MEMORY_API_BASE}/claim-free-trial`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fingerprint, sessionId }),
        });
        if (!res.ok)
            return null;
        const data = await res.json();
        return typeof data.allowed === 'boolean' ? data.allowed : null;
    }
    catch {
        return null;
    }
}
export async function pullSince(since, token) {
    try {
        const res = await fetch(`${MEMORY_API_BASE}/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(since ? { since } : {}),
        });
        if (!res.ok)
            return [];
        const data = await res.json();
        return data.entries ?? [];
    }
    catch {
        return [];
    }
}
/**
 * Keyword search against the caller's synced entries (catches entries written on
 * another device since the last `pullSince`). Caller is responsible for merging
 * with local results — this never throws, just returns [] on any failure.
 */
export async function searchCloud(query, limit, token) {
    try {
        const res = await fetch(`${MEMORY_API_BASE}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ query, limit }),
        });
        if (!res.ok)
            return [];
        const data = await res.json();
        return data.entries ?? [];
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=CloudSync.js.map