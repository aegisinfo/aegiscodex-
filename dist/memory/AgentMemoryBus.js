/**
 * AgentMemoryBus — Shared memory bus for multi-agent communication
 *
 * Purpose:
 *   Allows multiple agents (Orchestrator sub-agents, Council members)
 *   to read/write shared contextual memory in real-time.
 *
 * Design:
 *   - In-memory fast cache for active session + SQLite persistence
 *   - Channels: each agent publishes to typed channels
 *   - Sub-agents automatically get relevant context from prior agents
 *   - Supports TTL-based expiration, importance scoring, cross-referencing
 *
 * Integration with existing SharedMemory:
 *   AgentMemoryBus uses SharedMemory as its persistent backing store,
 *   adding a lightweight pub/sub layer on top for multi-agent coordination.
 */
import { sharedMemory } from './SharedMemory.js';
import { v4 as uuid } from 'uuid';
class MemoryCache {
    cache = new Map();
    byChannel = new Map();
    bySession = new Map();
    bySource = new Map();
    put(msg) {
        const expiresAt = msg.ttl && msg.ttl > 0 ? Date.now() + msg.ttl * 1000 : 0;
        this.cache.set(msg.id, { msg, expiresAt });
        if (!this.byChannel.has(msg.channel))
            this.byChannel.set(msg.channel, new Set());
        this.byChannel.get(msg.channel).add(msg.id);
        if (!this.bySession.has(msg.sessionId))
            this.bySession.set(msg.sessionId, new Set());
        this.bySession.get(msg.sessionId).add(msg.id);
        if (!this.bySource.has(msg.sourceAgent))
            this.bySource.set(msg.sourceAgent, new Set());
        this.bySource.get(msg.sourceAgent).add(msg.id);
    }
    get(id) {
        const entry = this.cache.get(id);
        if (!entry)
            return null;
        if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
            this.cache.delete(id);
            return null;
        }
        return entry.msg;
    }
    query(q) {
        this.evictExpired();
        let candidateIds = new Set(this.cache.keys());
        if (q.channels && q.channels.length > 0) {
            const channelIds = new Set();
            for (const ch of q.channels) {
                const ids = this.byChannel.get(ch);
                if (ids)
                    for (const id of ids)
                        channelIds.add(id);
            }
            candidateIds = intersect(candidateIds, channelIds);
        }
        if (q.sessionId) {
            const sessionIds = this.bySession.get(q.sessionId);
            candidateIds = sessionIds
                ? intersect(candidateIds, sessionIds)
                : new Set();
        }
        if (q.sourceAgent) {
            const sourceIds = this.bySource.get(q.sourceAgent);
            candidateIds = sourceIds
                ? intersect(candidateIds, sourceIds)
                : new Set();
        }
        if (q.targetAgent) {
            const filtered = new Set();
            for (const id of candidateIds) {
                const msg = this.cache.get(id)?.msg;
                if (msg && (!msg.targetAgent || msg.targetAgent === q.targetAgent)) {
                    filtered.add(id);
                }
            }
            candidateIds = filtered;
        }
        let results = Array.from(candidateIds)
            .map(id => this.cache.get(id).msg)
            .filter(msg => {
            if (q.minImportance !== undefined && msg.importance < q.minImportance)
                return false;
            if (q.maxAgeSeconds !== undefined) {
                const age = (Date.now() - new Date(msg.timestamp).getTime()) / 1000;
                if (age > q.maxAgeSeconds)
                    return false;
            }
            return true;
        });
        // Free-text filter
        if (q.query) {
            const lower = q.query.toLowerCase();
            results = results.filter(m => m.content.toLowerCase().includes(lower) ||
                (m.tags || []).some(t => t.toLowerCase().includes(lower)));
        }
        // Sort by importance desc, then timestamp desc
        results.sort((a, b) => {
            const imp = b.importance - a.importance;
            if (imp !== 0)
                return imp;
            return b.timestamp.localeCompare(a.timestamp);
        });
        return results.slice(0, q.limit || 20);
    }
    clearSession(sessionId) {
        const ids = this.bySession.get(sessionId);
        if (!ids)
            return;
        for (const id of ids) {
            const msg = this.cache.get(id)?.msg;
            if (msg) {
                this.byChannel.get(msg.channel)?.delete(id);
                this.bySource.get(msg.sourceAgent)?.delete(id);
                this.cache.delete(id);
            }
        }
        this.bySession.delete(sessionId);
    }
    size() {
        this.evictExpired();
        return this.cache.size;
    }
    evictExpired() {
        const now = Date.now();
        for (const [id, entry] of this.cache) {
            if (entry.expiresAt > 0 && now > entry.expiresAt) {
                const msg = entry.msg;
                this.byChannel.get(msg.channel)?.delete(id);
                this.bySession.get(msg.sessionId)?.delete(id);
                this.bySource.get(msg.sourceAgent)?.delete(id);
                this.cache.delete(id);
            }
        }
    }
}
function intersect(a, b) {
    const result = new Set();
    for (const item of a) {
        if (b.has(item))
            result.add(item);
    }
    return result;
}
// ── AgentMemoryBus ───────────────────────────────────────────────────────────
export class AgentMemoryBus {
    cache;
    subscribers = new Map();
    globalSubscribers = new Set();
    persistenceEnabled;
    constructor(persistToSharedMemory = true) {
        this.cache = new MemoryCache();
        this.persistenceEnabled = persistToSharedMemory;
    }
    /**
     * Publish a message to the shared memory bus.
     * Stored in fast cache + optionally persisted to SharedMemory SQLite.
     */
    async publish(msg) {
        const full = {
            ...msg,
            id: uuid(),
            timestamp: new Date().toISOString(),
        };
        // 1. Fast in-memory cache
        this.cache.put(full);
        // 2. Notify subscribers
        this.notifySubscribers(full);
        // 3. Persist to SharedMemory SQLite (if enabled)
        if (this.persistenceEnabled) {
            const channelTag = `agent:${msg.channel}`;
            const sourceTag = `agent:${msg.sourceAgent}`;
            const tags = [...(msg.tags || []), channelTag, sourceTag];
            if (msg.targetAgent)
                tags.push(`target:${msg.targetAgent}`);
            const importance = msg.importance;
            // Store as a memory entry so it appears in semantic search
            sharedMemory.add(`[AgentBus:${msg.channel}] [${msg.sourceAgent}]${msg.targetAgent ? ` → ${msg.targetAgent}` : ''}: ${msg.content}`, `agent-bus-${msg.channel}`, msg.sessionId, tags, 'assistant', false).catch(() => { });
            // High-importance items get stored with extra metadata
            if (importance >= 0.7) {
                sharedMemory.add(`[AgentBus:${msg.channel}] [DECISION] ${msg.sourceAgent}: ${msg.content}`, 'agent-bus-decision', msg.sessionId, [...tags, 'high-importance', 'decision'], 'assistant', true).catch(() => { });
            }
        }
        return full;
    }
    /**
     * Query messages from the shared memory bus (cache + persistent)
     */
    async query(q) {
        // 1. Get from fast cache
        const cached = this.cache.query(q);
        // 2. If we need more, search SharedMemory
        if (cached.length < (q.limit || 20) && this.persistenceEnabled) {
            const searchQuery = q.query || q.channels?.join(' ') || '';
            const persisted = await sharedMemory.search(`AgentBus ${searchQuery}`, (q.limit || 20) - cached.length);
            // Convert MemoryEntry → AgentMemoryMessage (best-effort)
            const fromPersisted = persisted
                .filter(e => e.content.startsWith('[AgentBus'))
                .map(e => this.entryToMessage(e))
                .filter((m) => m !== null);
            // Merge, deduplicate by ID
            const seen = new Set(cached.map(m => m.id));
            for (const m of fromPersisted) {
                if (!seen.has(m.id)) {
                    cached.push(m);
                    seen.add(m.id);
                }
            }
        }
        return cached;
    }
    /**
     * Subscribe to messages on a specific channel
     */
    subscribe(channel, callback) {
        if (!this.subscribers.has(channel)) {
            this.subscribers.set(channel, new Set());
        }
        this.subscribers.get(channel).add(callback);
        return () => this.subscribers.get(channel)?.delete(callback);
    }
    /**
     * Subscribe to all channels
     */
    subscribeAll(callback) {
        this.globalSubscribers.add(callback);
        return () => this.globalSubscribers.delete(callback);
    }
    /**
     * Get context for an agent: relevant messages from other agents in the same session
     */
    async getContextForAgent(agentName, sessionId, limit = 10, maxAgeSeconds = 300) {
        const relevant = await this.query({
            sessionId,
            limit,
            maxAgeSeconds,
        });
        // Filter out messages from the requesting agent
        const others = relevant.filter(m => m.sourceAgent !== agentName);
        if (others.length === 0)
            return '';
        const lines = [
            '--- AGENT MEMORY (shared context from other agents) ---',
        ];
        for (const m of others) {
            const target = m.targetAgent ? ` → ${m.targetAgent}` : '';
            lines.push(`[${m.channel}] ${m.sourceAgent}${target} (${m.timestamp.slice(11, 19)}): ${m.content.slice(0, 300)}`);
            if (m.importance >= 0.8)
                lines.push(`  ⭐ Important: ${m.content.slice(0, 200)}`);
        }
        lines.push('--- END AGENT MEMORY ---');
        return lines.join('\n');
    }
    /**
     * Clear all messages for a session
     */
    clearSession(sessionId) {
        this.cache.clearSession(sessionId);
    }
    /**
     * Get stats
     */
    stats() {
        let subCount = this.globalSubscribers.size;
        for (const subs of this.subscribers.values()) {
            subCount += subs.size;
        }
        return {
            cacheSize: this.cache.size(),
            subscribers: subCount,
            channels: this.subscribers.size,
        };
    }
    // ── Private ──────────────────────────────────────────────────────────────
    notifySubscribers(msg) {
        // Channel-specific
        const channelSubs = this.subscribers.get(msg.channel);
        if (channelSubs) {
            for (const cb of channelSubs) {
                try {
                    cb(msg);
                }
                catch { /* subscriber error */ }
            }
        }
        // Global
        for (const cb of this.globalSubscribers) {
            try {
                cb(msg);
            }
            catch { /* subscriber error */ }
        }
    }
    entryToMessage(entry) {
        try {
            const content = entry.content;
            // Parse: [AgentBus:channel] [sourceAgent] → targetAgent?: content
            const channelMatch = content.match(/^\[AgentBus:(\w+)\]/);
            const sourceMatch = content.match(/\] \[(\w+)\]/);
            const targetMatch = content.match(/\] → (\w+):/);
            const contentStart = content.indexOf(': ', content.lastIndexOf(']'));
            if (!channelMatch || !sourceMatch)
                return null;
            return {
                id: entry.id,
                channel: channelMatch[1],
                sourceAgent: sourceMatch[1],
                targetAgent: targetMatch ? targetMatch[1] : undefined,
                sessionId: entry.session,
                content: contentStart > 0 ? content.slice(contentStart + 2) : content,
                timestamp: entry.timestamp,
                importance: entry.importance || 0.5,
                tags: entry.tags,
            };
        }
        catch {
            return null;
        }
    }
}
// ── Singleton ────────────────────────────────────────────────────────────────
export const agentMemoryBus = new AgentMemoryBus(true);
//# sourceMappingURL=AgentMemoryBus.js.map