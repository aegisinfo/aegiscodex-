/**
 *
 *
 *
 */
export declare class CacheStore {
    private readonly cache;
    private readonly maxSize;
    private readonly defaultTtl;
    constructor(maxSize?: number, defaultTtl?: number);
    /**
     *
     */
    set<T>(key: string, value: T, ttl?: number): void;
    /**
     *
     */
    get<T>(key: string): T | undefined;
    /**
     *
     */
    has(key: string): boolean;
    /**
     *
     */
    delete(key: string): boolean;
    /**
     *
     */
    getOrSet<T>(key: string, factory: () => T | Promise<T>, ttl?: number): Promise<T>;
    /**
     *
     */
    private evictLRU;
    /**
     *
     */
    cleanup(): number;
    /**
     *
     */
    clear(): void;
    /**
     *
     */
    get size(): number;
    /**
     *
     */
    keys(): string[];
    /**
     *
     */
    getStats(): {
        size: number;
        maxSize: number;
        hitRate?: number;
    };
}
//# sourceMappingURL=CacheStore.d.ts.map