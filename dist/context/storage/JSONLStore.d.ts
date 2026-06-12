/**
 * JSONL 文件存储
 *
 *
 */
import type { JSONLEntry } from '../types.js';
export declare class JSONLStore {
    private readonly filePath;
    constructor(filePath: string);
    /**
     *
     */
    getFilePath(): string;
    /**
     *
     */
    exists(): boolean;
    /**
     *
     */
    append(entry: JSONLEntry): Promise<void>;
    /**
     *
     */
    appendBatch(entries: JSONLEntry[]): Promise<void>;
    /**
     *
     */
    readAll(): Promise<JSONLEntry[]>;
    /**
     *
     */
    readStream(callback: (entry: JSONLEntry) => void | Promise<void>): Promise<void>;
    /**
     *
     */
    readLast(count: number): Promise<JSONLEntry[]>;
    /**
     *
     */
    filter(predicate: (entry: JSONLEntry) => boolean): Promise<JSONLEntry[]>;
    /**
     *
     */
    count(): Promise<number>;
    /**
     *
     */
    readAfterCompaction(): Promise<JSONLEntry[]>;
    /**
     *
     */
    clear(): Promise<void>;
    /**
     *
     */
    delete(): Promise<void>;
    /**
     *
     */
    getFileSize(): Promise<number>;
}
//# sourceMappingURL=JSONLStore.d.ts.map