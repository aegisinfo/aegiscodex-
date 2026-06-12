/**
 *
 *
 *
 */
import type { CompactMetadata, SessionContext, ConversationContext } from '../types.js';
export declare class PersistentStore {
    private readonly projectPath;
    private readonly maxSessions;
    private readonly version;
    constructor(projectPath?: string, maxSessions?: number);
    /**
     *
     */
    private getStore;
    /**
     *
     */
    saveMessage(sessionId: string, messageRole: 'user' | 'assistant' | 'system', content: string, parentUuid?: string | null, metadata?: {
        model?: string;
        usage?: {
            input_tokens: number;
            output_tokens: number;
        };
    }): Promise<string>;
    /**
     *
     */
    saveToolUse(sessionId: string, toolId: string, toolName: string, input: unknown, parentUuid?: string | null): Promise<string>;
    /**
     *
     */
    saveToolResult(sessionId: string, toolId: string, output: unknown, error?: string, parentUuid?: string | null): Promise<string>;
    /**
     *
     */
    saveCompaction(sessionId: string, summary: string, metadata: CompactMetadata, parentUuid?: string | null): Promise<string>;
    /**
     *
     */
    loadSession(sessionId: string): Promise<SessionContext | null>;
    /**
     *
     */
    loadConversation(sessionId: string): Promise<ConversationContext | null>;
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
    getSessionStats(sessionId: string): Promise<{
        messageCount: number;
        fileSize: number;
        createdAt: Date | null;
        lastUpdatedAt: Date | null;
    } | null>;
}
//# sourceMappingURL=PersistentStore.d.ts.map