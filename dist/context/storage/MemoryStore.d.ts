/**
 *
 *
 *
 */
import type { ContextData, ContextMessage, MemoryInfo, ToolCallRecord } from '../types.js';
export declare class MemoryStore {
    private contextData;
    private readonly maxSize;
    private readonly accessLog;
    constructor(maxSize?: number);
    /**
     *
     */
    setContext(data: ContextData): void;
    /**
     *
     */
    getContext(): ContextData | null;
    /**
     *
     */
    hasData(): boolean;
    /**
     *
     */
    addMessage(message: ContextMessage): void;
    /**
     *
     */
    getMessages(): ContextMessage[];
    /**
     *
     */
    setMessages(messages: ContextMessage[]): void;
    /**
     *
     */
    addToolCall(toolCall: ToolCallRecord): void;
    /**
     *
     */
    updateToolCallResult(toolCallId: string, output: unknown, error?: string): void;
    /**
     *
     */
    getRecentToolCalls(count?: number): ToolCallRecord[];
    /**
     *
     */
    updateTokenCount(tokens: number): void;
    /**
     *
     */
    getTokenCount(): number;
    /**
     *
     */
    private enforceMemoryLimit;
    /**
     *
     */
    private recordAccess;
    /**
     *
     */
    getLastAccess(key: string): number | undefined;
    /**
     *
     */
    getMemoryInfo(): MemoryInfo;
    /**
     *
     */
    getSessionId(): string | null;
    /**
     *
     */
    clear(): void;
}
//# sourceMappingURL=MemoryStore.d.ts.map