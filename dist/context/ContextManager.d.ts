/**
 *
 *
 *
 */
import type { ContextData, ContextMessage, ContextManagerOptions, CompactionResult } from './types.js';
export declare class ContextManager {
    private readonly memory;
    private readonly persistent;
    private readonly cache;
    private readonly options;
    private currentSessionId;
    private readonly pendingSaves;
    constructor(options?: Partial<ContextManagerOptions>);
    /**
     *
     */
    createSession(userId?: string, preferences?: Record<string, unknown>, configuration?: Record<string, unknown>): Promise<string>;
    /**
     *
     */
    private createSystemContext;
    /**
     *
     */
    private createWorkspaceContext;
    /**
     *
     */
    addMessage(role: ContextMessage['role'], content: string, metadata?: Record<string, unknown>): Promise<void>;
    /**
     *
     */
    private shouldCompress;
    /**
     * Persist message to JSONL synchronously (awaited by the caller).
     * The promise is tracked so cleanup() can flush before exit.
     */
    private saveMessagePersist;
    /**
     * Flush all pending saves — call before exit to ensure no data loss.
     */
    flush(): Promise<void>;
    /**
     *
     */
    compressCurrentContext(): Promise<CompactionResult | null>;
    /**
     *
     */
    manualCompact(): Promise<CompactionResult | null>;
    /**
     *
     */
    loadSession(sessionId: string): Promise<boolean>;
    /**
     *
     */
    getCurrentSessionId(): string | null;
    /**
     *
     */
    getContext(): ContextData | null;
    /**
     *
     */
    getMessages(): ContextMessage[];
    /**
     *
     */
    getTokenCount(): number;
    /**
     *
     */
    updateTokenCount(tokens: number): void;
    /**
     *
     */
    replaceMessages(messages: ContextMessage[]): void;
    /**
     *
     */
    getCache<T>(key: string): T | undefined;
    /**
     *
     */
    setCache<T>(key: string, value: T, ttl?: number): void;
    /**
     *
     */
    listSessions(): Promise<string[]>;
    /**
     *
     */
    deleteSession(sessionId: string): Promise<void>;
    /**
     *
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=ContextManager.d.ts.map