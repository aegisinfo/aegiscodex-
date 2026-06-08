/**
 * JSONL 文件存储
 * 
 * 
 */

import * as fs from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import * as path from 'node:path';
import type { JSONLEntry } from '../types.js';

export class JSONLStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * 
   */
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * 
   */
  exists(): boolean {
    return existsSync(this.filePath);
  }

  /**
   * 
   */
  async append(entry: JSONLEntry): Promise<void> {
    // 确保父目录存
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    // 序列化并追
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(this.filePath, line, 'utf-8');
  }

  /**
   * 
   */
  async appendBatch(entries: JSONLEntry[]): Promise<void> {
    if (entries.length === 0) return;

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    const lines = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
    await fs.appendFile(this.filePath, lines, 'utf-8');
  }

  /**
   * 
   */
  async readAll(): Promise<JSONLEntry[]> {
    if (!this.exists()) {
      return [];
    }

    const content = await fs.readFile(this.filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim().length > 0);

    const entries: JSONLEntry[] = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as JSONLEntry);
      } catch (parseError) {
        console.warn(`[JSONLStore] 解析 JSON 行失败: ${line.substring(0, 100)}...`);
      }
    }
    return entries;
  }

  /**
   * 
   */
  async readStream(callback: (entry: JSONLEntry) => void | Promise<void>): Promise<void> {
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

      const processLine = async (line: string) => {
        const trimmed = line.trim();
        if (trimmed.length === 0) return;

        try {
          const entry = JSON.parse(trimmed) as JSONLEntry;
          await callback(entry);
        } catch (error) {
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
  async readLast(count: number): Promise<JSONLEntry[]> {
    const all = await this.readAll();
    return all.slice(-count);
  }

  /**
   * 
   */
  async filter(predicate: (entry: JSONLEntry) => boolean): Promise<JSONLEntry[]> {
    const all = await this.readAll();
    return all.filter(predicate);
  }

  /**
   * 
   */
  async count(): Promise<number> {
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
  async readAfterCompaction(): Promise<JSONLEntry[]> {
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
  async clear(): Promise<void> {
    if (this.exists()) {
      await fs.writeFile(this.filePath, '', 'utf-8');
    }
  }

  /**
   * 
   */
  async delete(): Promise<void> {
    if (this.exists()) {
      await fs.unlink(this.filePath);
    }
  }

  /**
   * 
   */
  async getFileSize(): Promise<number> {
    if (!this.exists()) {
      return 0;
    }
    const stats = await fs.stat(this.filePath);
    return stats.size;
  }
}
