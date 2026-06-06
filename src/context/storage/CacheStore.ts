/**
 * 
 * 
 * 
 */

interface CacheEntry<T> {
  value: T;
  createdAt: number;
  lastAccessedAt: number;
  ttl: number;
}

export class CacheStore {
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTtl: number;

  constructor(maxSize: number = 100, defaultTtl: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;
  }

  /**
   * 
   */
  set<T>(key: string, value: T, ttl?: number): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      createdAt: now,
      lastAccessedAt: now,
      ttl: ttl ?? this.defaultTtl,
    });
  }

  /**
   * 
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }
    const now = Date.now();
    if (now - entry.createdAt > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    entry.lastAccessedAt = now;
    return entry.value as T;
  }

  /**
   * 
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    const now = Date.now();
    if (now - entry.createdAt > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 
   */
  async getOrSet<T>(
    key: string,
    factory: () => T | Promise<T>,
    ttl?: number
  ): Promise<T> {
    const existing = this.get<T>(key);
    if (existing !== undefined) {
      return existing;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * 
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate?: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}
