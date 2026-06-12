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
export type AgentChannel = 'decision' | 'fact' | 'context' | 'intermediate' | 'error' | 'question' | 'suggestion';
export interface AgentMemoryMessage {
    id: string;
    channel: AgentChannel;
    sourceAgent: string;
    targetAgent?: string;
    sessionId: string;
    content: string;
    timestamp: string;
    importance: number;
    references?: string[];
    ttl?: number;
    tags?: string[];
    metadata?: Record<string, unknown>;
}
export interface AgentMemoryQuery {
    channels?: AgentChannel[];
    sourceAgent?: string;
    targetAgent?: string;
    sessionId?: string;
    query?: string;
    limit?: number;
    minImportance?: number;
    maxAgeSeconds?: number;
}
export declare class AgentMemoryBus {
    private cache;
    private subscribers;
    private globalSubscribers;
    private persistenceEnabled;
    constructor(persistToSharedMemory?: boolean);
    /**
     * Publish a message to the shared memory bus.
     * Stored in fast cache + optionally persisted to SharedMemory SQLite.
     */
    publish(msg: Omit<AgentMemoryMessage, 'id' | 'timestamp'>): Promise<AgentMemoryMessage>;
    /**
     * Query messages from the shared memory bus (cache + persistent)
     */
    query(q: AgentMemoryQuery): Promise<AgentMemoryMessage[]>;
    /**
     * Subscribe to messages on a specific channel
     */
    subscribe(channel: AgentChannel, callback: (msg: AgentMemoryMessage) => void): () => void;
    /**
     * Subscribe to all channels
     */
    subscribeAll(callback: (msg: AgentMemoryMessage) => void): () => void;
    /**
     * Get context for an agent: relevant messages from other agents in the same session
     */
    getContextForAgent(agentName: string, sessionId: string, limit?: number, maxAgeSeconds?: number): Promise<string>;
    /**
     * Clear all messages for a session
     */
    clearSession(sessionId: string): void;
    /**
     * Get stats
     */
    stats(): {
        cacheSize: number;
        subscribers: number;
        channels: number;
    };
    private notifySubscribers;
    private entryToMessage;
}
export declare const agentMemoryBus: AgentMemoryBus;
//# sourceMappingURL=AgentMemoryBus.d.ts.map