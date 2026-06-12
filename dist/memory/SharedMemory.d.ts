export interface MemoryEntry {
    id: string;
    timestamp: string;
    source: string;
    role: 'user' | 'assistant';
    tags: string[];
    content: string;
    session: string;
    importance?: number;
    summary?: boolean;
    topics?: string[];
    entities?: string[];
    sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
    tokenCount?: number;
    embedding?: number[] | null;
}
export interface MemoryConfig {
    ttlDays?: number;
    maxEntries?: number;
    summaryEnabled?: boolean;
    embeddingModel?: string;
}
export declare function setOllamaBaseUrl(url?: string): void;
export declare class SharedMemory {
    private db;
    readonly userId: string;
    private embedder;
    private ready;
    constructor();
    private init;
    /** Await readiness before any operation */
    private ensureReady;
    private loadUserId;
    private applyTTL;
    add(content: string, source: string, session: string, tags?: string[], role?: 'user' | 'assistant', immediate?: boolean): Promise<MemoryEntry | null>;
    search(query: string, limit?: number): Promise<MemoryEntry[]>;
    recent(limit?: number): MemoryEntry[];
    summarizeAndStoreSession(sessionId: string, apiKey?: string, baseURL?: string, model?: string): Promise<boolean>;
    private summarizeSession;
    buildContext(query: string, maxEntries?: number, currentSession?: string): Promise<string>;
    private rowsToEntries;
    private commit;
    isSubscribed(): boolean;
    /** Returns true only for write operations: subscribed, or this IS the free-tier session. */
    isWriteAllowed(sessionId: string): boolean;
    /** Returns true for reads: subscribed, OR free session was ever used (let them see value). */
    isEnabled(): boolean;
    /**
     * Returns an upgrade reminder if the session has exhausted the free tier.
     * Returns null if subscribed or still within the free session.
     * Call once at session start; reminder is suppressed after the first call this process.
     */
    private _reminderShownThisProcess;
    getUpgradeReminder(sessionId: string): string | null;
    /** Record the free-tier session ID the first time this session writes to memory. */
    private recordFreeSession;
    size(): number;
    clear(): void;
    export(): MemoryEntry[];
    import(entries: MemoryEntry[], merge?: boolean): void;
    getSessionEntries(sessionId: string): MemoryEntry[];
    getStats(): {
        total: number;
        sessions: number;
        summaries: number;
        avgImportance: string;
        enabled: boolean;
        withEmbeddings: number;
        embeddingsEnabled: boolean;
    };
    /** Search by topic */
    searchByTopic(topic: string, limit?: number): MemoryEntry[];
    /** Search by entity */
    searchByEntity(entity: string, limit?: number): MemoryEntry[];
}
export declare const sharedMemory: SharedMemory;
//# sourceMappingURL=SharedMemory.d.ts.map