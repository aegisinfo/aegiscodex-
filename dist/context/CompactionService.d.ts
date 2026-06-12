/**
 *
 *
 *
 */
import type { Message } from '../agent/types.js';
import type { CompactionOptions, CompactionResult } from './types.js';
export declare class CompactionService {
    /** 压缩阈值百分比（80%） */
    private static readonly THRESHOLD_PERCENT;
    /** 保留比例（20%） */
    private static readonly RETAIN_PERCENT;
    /** 降级时保留比例（30%） */
    private static readonly FALLBACK_RETAIN_PERCENT;
    /**
     *
     */
    static shouldCompact(messages: Message[], modelName: string, maxContextTokens: number): boolean;
    /**
     *
     */
    static compact(messages: Message[], options: CompactionOptions): Promise<CompactionResult>;
    /**
     *
     */
    private static generateSummary;
    /**
     *
     */
    private static buildCompactionPrompt;
    /**
     *
     */
    private static createFallbackSummary;
    /**
     *
     */
    private static filterOrphanToolMessages;
    /**
     *
     */
    private static createSummaryMessage;
    /**
     *
     */
    private static fallbackCompact;
    /**
     *
     */
    static forceCompact(messages: Message[], options: Omit<CompactionOptions, 'trigger'>): Promise<CompactionResult>;
}
//# sourceMappingURL=CompactionService.d.ts.map