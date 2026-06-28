/**
 * BettermentService — learns from past compactions to improve future ones.
 *
 * Tracks compaction quality metrics, collects user ratings, and adapts
 * compaction parameters (retention ratio, prompt style) based on history.
 */

import * as fs   from 'node:fs';
import * as path from 'node:path';
import * as os   from 'node:os';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CompactionRecord {
  id: string;
  timestamp: string;
  trigger: 'auto' | 'manual';
  preTokens: number;
  postTokens: number;
  savedTokens: number;
  savedPercent: number;
  messageCount: number;
  retainedCount: number;
  usedLLMSummary: boolean;
  filesIncluded: number;
  sessionId?: string;
  projectDir?: string;
  /** User rating: 1 (poor) .. 5 (excellent), 0 = unrated */
  rating: number;
  /** Optional user note */
  note?: string;
}

export interface BettermentStats {
  totalCompactions: number;
  ratedCount: number;
  averageRating: number;
  averageSavings: number;
  bestSession: string;
  llmUsageRate: number;
  trend: 'improving' | 'stable' | 'declining';
  suggestions: string[];
}

export interface BettermentConfig {
  /** How many recent records to keep for trend analysis */
  historySize: number;
  /** Minimum records before making suggestions */
  minRecordsForSuggestions: number;
  /** Whether adaptive retention is enabled */
  adaptiveRetention: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const BETTERMENT_DIR  = path.join(os.homedir(), '.aegiscode');
const BETTERMENT_FILE = path.join(BETTERMENT_DIR, 'betterment.json');
const DEFAULT_CONFIG: BettermentConfig = {
  historySize: 100,
  minRecordsForSuggestions: 5,
  adaptiveRetention: true,
};

// ── Service ──────────────────────────────────────────────────────────────────

export class BettermentService {
  private records: CompactionRecord[] = [];
  private config: BettermentConfig;

  constructor(config: Partial<BettermentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.load();
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  private load(): void {
    try {
      fs.mkdirSync(BETTERMENT_DIR, { recursive: true });
      if (fs.existsSync(BETTERMENT_FILE)) {
        const raw = fs.readFileSync(BETTERMENT_FILE, 'utf-8').trim();
        if (raw) {
          this.records = JSON.parse(raw);
        }
      }
    } catch (e) {
      this.records = [];
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(BETTERMENT_DIR, { recursive: true });
      // Keep only the latest N records
      if (this.records.length > this.config.historySize) {
        this.records = this.records.slice(-this.config.historySize);
      }
      fs.writeFileSync(BETTERMENT_FILE, JSON.stringify(this.records, null, 2), 'utf-8');
    } catch {
      // silent — betterment is advisory
    }
  }

  // ── Record a compaction ─────────────────────────────────────────────────

  recordCompaction(entry: Omit<CompactionRecord, 'rating'>): void {
    const record: CompactionRecord = {
      ...entry,
      rating: 0,
    };
    this.records.push(record);
    this.save();
  }

  // ── Rate a compaction ───────────────────────────────────────────────────

  rateLastCompaction(rating: number, note?: string): boolean {
    if (this.records.length === 0) return false;
    const last = this.records[this.records.length - 1];
    if (last.rating !== 0) return false; // already rated
    last.rating = Math.max(1, Math.min(5, rating));
    if (note) last.note = note;
    this.save();
    return true;
  }

  rateCompactionById(id: string, rating: number, note?: string): boolean {
    const record = this.records.find(r => r.id === id);
    if (!record) return false;
    record.rating = Math.max(1, Math.min(5, rating));
    if (note) record.note = note;
    this.save();
    return true;
  }

  /** Get the last compaction record (for rating immediately after /compact). */
  getLastCompaction(): CompactionRecord | null {
    return this.records.length > 0 ? this.records[this.records.length - 1] : null;
  }

  // ── Stats ───────────────────────────────────────────────────────────────

  getStats(): BettermentStats {
    const total = this.records.length;
    const rated = this.records.filter(r => r.rating > 0);
    const ratedCount = rated.length;
    const averageRating = ratedCount > 0
      ? rated.reduce((s, r) => s + r.rating, 0) / ratedCount
      : 0;
    const averageSavings = total > 0
      ? this.records.reduce((s, r) => s + r.savedPercent, 0) / total
      : 0;
    const llmUsageRate = total > 0
      ? this.records.filter(r => r.usedLLMSummary).length / total * 100
      : 0;

    // Find best session by average rating
    const bySession = new Map<string, CompactionRecord[]>();
    for (const r of this.records) {
      const key = r.sessionId || 'unknown';
      if (!bySession.has(key)) bySession.set(key, []);
      bySession.get(key)!.push(r);
    }
    let bestSession = '—';
    let bestAvg = 0;
    for (const [sid, recs] of bySession) {
      const ratedInSession = recs.filter(r => r.rating > 0);
      if (ratedInSession.length > 0) {
        const avg = ratedInSession.reduce((s, r) => s + r.rating, 0) / ratedInSession.length;
        if (avg > bestAvg) {
          bestAvg = avg;
          bestSession = sid.slice(0, 12);
        }
      }
    }

    // Trend: compare recent 1/3 vs oldest 1/3
    const trend = this.computeTrend();

    // Suggestions
    const suggestions = this.generateSuggestions();

    return {
      totalCompactions: total,
      ratedCount,
      averageRating,
      averageSavings,
      bestSession,
      llmUsageRate,
      trend,
      suggestions,
    };
  }

  private computeTrend(): 'improving' | 'stable' | 'declining' {
    if (this.records.length < 6) return 'stable';
    const third = Math.floor(this.records.length / 3);
    const recent = this.records.slice(-third).filter(r => r.rating > 0);
    const early = this.records.slice(0, third).filter(r => r.rating > 0);
    if (recent.length < 2 || early.length < 2) return 'stable';
    const recentAvg = recent.reduce((s, r) => s + r.rating, 0) / recent.length;
    const earlyAvg = early.reduce((s, r) => s + r.rating, 0) / early.length;
    const diff = recentAvg - earlyAvg;
    if (diff > 0.5) return 'improving';
    if (diff < -0.5) return 'declining';
    return 'stable';
  }

  private generateSuggestions(): string[] {
    const suggestions: string[] = [];
    if (this.records.length < this.config.minRecordsForSuggestions) {
      suggestions.push('Keep using /compact and rate results with /compact rate to get personalized suggestions.');
      return suggestions;
    }

    const stats = this.getStats();

    // Low LLM usage — suggest it
    if (stats.llmUsageRate < 50) {
      suggestions.push('LLM-powered summaries are used in fewer than half of compactions. Ensure a chatService is configured for better summaries.');
    }

    // Low rating trend
    if (stats.averageRating > 0 && stats.averageRating < 3 && stats.ratedCount >= 3) {
      suggestions.push('Compaction quality is rated below 3/5. Consider adjusting maxContextTokens or review the summary prompt.');
    }

    // High savings but low rating — retaining too little
    const highSavingsLowRating = this.records.filter(r => r.savedPercent > 70 && r.rating > 0 && r.rating < 3);
    if (highSavingsLowRating.length >= 2) {
      suggestions.push('High token savings but low ratings — compaction may be too aggressive. Consider increasing retention ratio.');
    }

    // Adaptive retention hint
    if (this.config.adaptiveRetention) {
      const recentSavings = this.records.slice(-5).reduce((s, r) => s + r.savedPercent, 0) / 5;
      const recommendedRetention = recentSavings > 60 ? 'increase to 0.3' : recentSavings < 30 ? 'decrease to 0.15' : 'keep at 0.2';
      suggestions.push(`Based on recent trends, consider adjusting retention ratio (recommended: ${recommendedRetention}).`);
    }

    if (suggestions.length === 0) {
      suggestions.push('All good — keep compacting and rating.');
    }

    return suggestions;
  }

  // ── Adaptive parameters ─────────────────────────────────────────────────

  /**
   * Get an adaptive retention ratio based on compaction history.
   * Returns a value between 0.1 and 0.4.
   */
  getAdaptiveRetention(): number {
    if (!this.config.adaptiveRetention || this.records.length < 3) {
      return 0.2; // default
    }

    // Look at the last 5 rated compactions
    const recent = this.records.slice(-5).filter(r => r.rating > 0);
    if (recent.length < 2) return 0.2;

    const avgRating = recent.reduce((s, r) => s + r.rating, 0) / recent.length;
    const avgSavings = recent.reduce((s, r) => s + r.savedPercent, 0) / recent.length;

    // High rating + high savings → aggressive retention (keep more, summarize better)
    if (avgRating >= 4 && avgSavings > 50) return 0.25;
    // Low rating + high savings → too aggressive, keep more
    if (avgRating < 3 && avgSavings > 60) return 0.30;
    // Low rating + low savings → not aggressive enough or poor summaries
    if (avgRating < 3 && avgSavings < 30) return 0.25;
    // High rating + low savings → can be more aggressive
    if (avgRating >= 4 && avgSavings < 30) return 0.15;

    return 0.20;
  }

  /**
   * Get a prompt suffix based on compaction history.
   * Returns a string to append to the summary prompt, or empty string.
   */
  getPromptBias(): string {
    if (this.records.length < 3) return '';

    const recentLow = this.records.slice(-5).filter(r => r.rating > 0 && r.rating <= 2);
    if (recentLow.length >= 2) {
      // Users are unhappy — tell the LLM to be more detailed
      return '\n\nNote: Previous summaries were rated as insufficiently detailed. Please err on the side of including more specific technical details, file paths, and code snippets.';
    }

    const recentHigh = this.records.slice(-5).filter(r => r.rating >= 4);
    if (recentHigh.length >= 3) {
      return '\n\nNote: Summaries have been well-received. Maintain the current level of detail and structure.';
    }

    return '';
  }

  /**
   * Get a human-readable report of the adaptive state.
   */
  getAdaptiveReport(): string {
    const retention = this.getAdaptiveRetention();
    const promptBias = this.getPromptBias();
    const stats = this.getStats();

    return [
      `## Compaction Betterment Report`,
      ``,
      `| metric | value |`,
      `|--------|-------|`,
      `| total compactions | ${stats.totalCompactions} |`,
      `| rated | ${stats.ratedCount} |`,
      `| avg rating | ${stats.averageRating.toFixed(2)} / 5 |`,
      `| avg token savings | ${stats.averageSavings.toFixed(1)}% |`,
      `| LLM summary rate | ${stats.llmUsageRate.toFixed(0)}% |`,
      `| trend | ${stats.trend} |`,
      `| adaptive retention | ${(retention * 100).toFixed(0)}% |`,
      `| best session | ${stats.bestSession} |`,
      ``,
      `### Suggestions`,
      ...stats.suggestions.map(s => `- ${s}`),
      ``,
      promptBias ? `### Active Prompt Bias\n${promptBias.trim()}` : '',
    ].filter(Boolean).join('\n');
  }

  /**
   * Get the full compaction history.
   */
  getHistory(): CompactionRecord[] {
    return [...this.records];
  }

  /**
   * Clear all compaction records.
   */
  clear(): void {
    this.records = [];
    this.save();
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

export const betterment = new BettermentService();
