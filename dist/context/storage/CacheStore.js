/**
 *
 *
 *
 */
export class CacheStore {
    cache = new Map();
    maxSize;
    defaultTtl;
    constructor(maxSize = 100, defaultTtl = 5 * 60 * 1000) {
        this.maxSize = maxSize;
        this.defaultTtl = defaultTtl;
    }
    /**
     *
     */
    set(key, value, ttl) {
        // 检查是否需要淘
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
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return undefined;
        }
        // 检查是否过
        const now = Date.now();
        if (now - entry.createdAt > entry.ttl) {
            this.cache.delete(key);
            return undefined;
        }
        // 更新访问时
        entry.lastAccessedAt = now;
        return entry.value;
    }
    /**
     *
     */
    has(key) {
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
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     *
     */
    async getOrSet(key, factory, ttl) {
        const existing = this.get(key);
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
    evictLRU() {
        let oldestKey = null;
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
    cleanup() {
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
    clear() {
        this.cache.clear();
    }
    /**
     *
     */
    get size() {
        return this.cache.size;
    }
    /**
     *
     */
    keys() {
        return Array.from(this.cache.keys());
    }
    /**
     *
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
        };
    }
}
//# sourceMappingURL=CacheStore.js.map