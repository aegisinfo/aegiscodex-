/**
 * Token
 *
 *
 */
import type { Message } from '../agent/types.js';
export declare class TokenCounter {
    private static encodingCache;
    /**
     *
     */
    static countTokens(messages: Message[], modelName: string): number;
    /**
     *
     */
    static countMessageTokens(message: Message, modelName: string): number;
    /**
     *
     */
    static countTextTokens(text: string, modelName: string): number;
    /**
     *
     */
    private static countToolCallTokens;
    /**
     *
     */
    static shouldCompact(messages: Message[], modelName: string, maxTokens: number, thresholdPercent?: number): boolean;
    /**
     *
     */
    private static getEncoding;
    /**
     *
     */
    private static normalizeModelName;
    /**
     *
     *
     *
     */
    static estimateTokens(text: string): number;
    /**
     *
     */
    static estimateMessagesTokens(messages: Message[]): number;
    /**
     *
     */
    static getRemainingTokens(messages: Message[], modelName: string, maxContextTokens: number, maxOutputTokens?: number): number;
    /**
     *
     */
    static truncateMessages(messages: Message[], modelName: string, maxTokens: number): Message[];
    /**
     *
     */
    static clearCache(): void;
}
//# sourceMappingURL=TokenCounter.d.ts.map