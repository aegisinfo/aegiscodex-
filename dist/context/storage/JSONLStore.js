/**
 * JSONL 文件存储
 *
 *
 */
import * as fs from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import * as path from 'node:path';
export class JSONLStore {
    filePath;
    constructor(filePath) {
        this.filePath = filePath;
    }
    /**
     *
     */
    getFilePath() {
        return this.filePath;
    }
    /**
     *
     */
    exists() {
        return existsSync(this.filePath);
    }
    /**
     *
     */
    async append(entry) {
        // 确保父目录存
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        // 序列化并追
        const line = JSON.stringify(entry) + '\n';
        await fs.appendFile(this.filePath, line, 'utf-8');
    }
    /**
     *
     */
    async appendBatch(entries) {
        if (entries.length === 0)
            return;
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        const lines = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
        await fs.appendFile(this.filePath, lines, 'utf-8');
    }
    /**
     *
     */
    async readAll() {
        if (!this.exists()) {
            return [];
        }
        const content = await fs.readFile(this.filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim().length > 0);
        const entries = [];
        for (const line of lines) {
            try {
                entries.push(JSON.parse(line));
            }
            catch (parseError) {
                console.warn(`[JSONLStore] 解析 JSON 行失败: ${line.substring(0, 100)}...`);
            }
        }
        return entries;
    }
    /**
     *
     */
    async readStream(callback) {
        return new Promise((resolve, reject) => {
            if (!this.exists()) {
                resolve();
                return;
            }
            const fileStream = createReadStream(this.filePath, { encoding: 'utf-8' });
            const rl = createInterface({
                input: fileStream,
                crlfDelay: Number.POSITIVE_INFINITY,
            });
            const processLine = async (line) => {
                const trimmed = line.trim();
                if (trimmed.length === 0)
                    return;
                try {
                    const entry = JSON.parse(trimmed);
                    await callback(entry);
                }
                catch (error) {
                    console.warn(`[JSONLStore] 解析失败: ${trimmed.substring(0, 50)}...`);
                }
            };
            rl.on('line', (line) => {
                processLine(line).catch(reject);
            });
            rl.on('close', () => resolve());
            rl.on('error', reject);
            fileStream.on('error', reject);
        });
    }
    /**
     *
     */
    async readLast(count) {
        const all = await this.readAll();
        return all.slice(-count);
    }
    /**
     *
     */
    async filter(predicate) {
        const all = await this.readAll();
        return all.filter(predicate);
    }
    /**
     *
     */
    async count() {
        if (!this.exists()) {
            return 0;
        }
        let count = 0;
        await this.readStream(() => {
            count++;
        });
        return count;
    }
    /**
     *
     */
    async readAfterCompaction() {
        const all = await this.readAll();
        // 找到最后一个压缩边
        let boundaryIndex = -1;
        for (let i = all.length - 1; i >= 0; i--) {
            if (all[i].subtype === 'compact_boundary') {
                boundaryIndex = i;
                break;
            }
        }
        // 如果没有压缩边界，返回所有记
        if (boundaryIndex === -1) {
            return all;
        }
        // 返回压缩边界之后的记录（包括压缩总
        return all.slice(boundaryIndex);
    }
    /**
     *
     */
    async clear() {
        if (this.exists()) {
            await fs.writeFile(this.filePath, '', 'utf-8');
        }
    }
    /**
     *
     */
    async delete() {
        if (this.exists()) {
            await fs.unlink(this.filePath);
        }
    }
    /**
     *
     */
    async getFileSize() {
        if (!this.exists()) {
            return 0;
        }
        const stats = await fs.stat(this.filePath);
        return stats.size;
    }
}
//# sourceMappingURL=JSONLStore.js.map