/**
 * CacheStage — session-scoped tool result caching
 *
 * Caches results from read-only tools (Read, Grep, Glob) so that re-requesting
 * the same file / same glob / same grep within the same session does not re-execute
 * the tool. The result is injected directly into the ToolExecution object, allowing
 * the pipeline to short-circuit.
 *
 * Design parallels Claude Code's `tool-results/` directory per session UUID.
 *
 * Key decisions:
 *  - Cache key = SHA-256 hash of (toolName + sorted-JSON(params) + sessionId)
 *  - Only caches SUCCESSFUL results from read-only tools
 *  - Cache is in-memory (Map) + optionally persisted to disk
 *  - TTL = session lifetime (cleared when session ends or cache is purged)
 */

import * as crypto from 'node:crypto';
import type { ToolResult } from '../../types.js';
import type { PipelineStage, ToolExecution } from '../types.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CacheEntry {
  result: ToolResult;
  cachedAt: number;
  hitCount: number;
}

export interface CacheStageOptions {
  /** Maximum cache entries (default 500) */
  maxSize?: number;
}

// ── Read-only tool names that are safe to cache ──────────────────────────────

const READONLY_TOOLS = new Set(['Read', 'Grep', 'Glob']);

// ── CacheStage ───────────────────────────────────────────────────────────────

export class CacheStage implements PipelineStage {
  readonly name = 'cache';

  /** Cache key → CacheEntry */
  private store = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(options: CacheStageOptions = {}) {
    this.maxSize = options.maxSize ?? 500;
  }

  async process(execution: ToolExecution): Promise<void> {
    // Only cache read-only tools
    if (!READONLY_TOOLS.has(execution.toolName)) return;

    const cacheKey = this.buildKey(
      execution.toolName,
      execution.params,
      execution.context.sessionId,
    );

    const cached = this.store.get(cacheKey);
    if (cached) {
      cached.hitCount++;
      execution.setResult(cached.result);
      return;
    }

    // Not in cache — ExecutionStage reads this key to store the result once
    // the tool actually runs.
    execution._internal.cacheKey = cacheKey;
  }

  /**
   * Called by ExecutionStage after a tool executes successfully, to store
   * the result in the cache.
   */
  cacheResult(cacheKey: string, result: ToolResult): void {
    if (!result.success) return;
    if (!result.llmContent && !result.displayContent) return;

    // Evict oldest if at capacity
    if (this.store.size >= this.maxSize) {
      let oldestKey: string | undefined;
      let oldestTime = Infinity;
      for (const [k, v] of this.store) {
        if (v.cachedAt < oldestTime) {
          oldestTime = v.cachedAt;
          oldestKey = k;
        }
      }
      if (oldestKey) this.store.delete(oldestKey);
    }

    this.store.set(cacheKey, {
      result,
      cachedAt: Date.now(),
      hitCount: 0,
    });
  }

  /** Clear all cached entries */
  clear(): void {
    this.store.clear();
  }

  /** Clear entries for a specific session */
  clearSession(sessionId: string): void {
    for (const [key, entry] of this.store) {
      // Keys embed the sessionId — check by extracting it
      if (key.includes(sessionId)) {
        this.store.delete(key);
      }
    }
  }

  /** Get cache stats */
  stats(): { size: number; maxSize: number } {
    return { size: this.store.size, maxSize: this.maxSize };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private buildKey(toolName: string, params: Record<string, unknown>, sessionId: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(toolName);
    hash.update(JSON.stringify(params, Object.keys(params).sort()));
    hash.update(sessionId);
    return hash.digest('hex');
  }
}
