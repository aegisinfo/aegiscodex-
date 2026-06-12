/**
 *
 *
 *
 */
import { nanoid } from 'nanoid';
import { JSONLStore } from './JSONLStore.js';
import { getSessionFilePath, detectGitBranch } from './pathUtils.js';
// 获取版本
let packageVersion = '0.1.0';
try {
    const packageJson = await import('../../../package.json', { with: { type: 'json' } });
    packageVersion = packageJson.default.version || '0.1.0';
}
catch {
    // 忽略错
}
export class PersistentStore {
    projectPath;
    maxSessions;
    version;
    constructor(projectPath = process.cwd(), maxSessions = 100) {
        this.projectPath = projectPath;
        this.maxSessions = maxSessions;
        this.version = packageVersion;
    }
    /**
     *
     */
    getStore(sessionId) {
        const filePath = getSessionFilePath(this.projectPath, sessionId);
        return new JSONLStore(filePath);
    }
    /**
     *
     */
    async saveMessage(sessionId, messageRole, content, parentUuid = null, metadata) {
        const store = this.getStore(sessionId);
        const entry = {
            uuid: nanoid(),
            parentUuid,
            sessionId,
            timestamp: new Date().toISOString(),
            type: messageRole,
            cwd: this.projectPath,
            gitBranch: detectGitBranch(this.projectPath),
            version: this.version,
            message: {
                role: messageRole,
                content,
                ...(metadata || {}),
            },
        };
        await store.append(entry);
        return entry.uuid;
    }
    /**
     *
     */
    async saveToolUse(sessionId, toolId, toolName, input, parentUuid = null) {
        const store = this.getStore(sessionId);
        const entry = {
            uuid: nanoid(),
            parentUuid,
            sessionId,
            timestamp: new Date().toISOString(),
            type: 'tool_use',
            cwd: this.projectPath,
            gitBranch: detectGitBranch(this.projectPath),
            version: this.version,
            message: {
                role: 'assistant',
                content: '',
            },
            tool: {
                id: toolId,
                name: toolName,
                input,
            },
        };
        await store.append(entry);
        return entry.uuid;
    }
    /**
     *
     */
    async saveToolResult(sessionId, toolId, output, error, parentUuid = null) {
        const store = this.getStore(sessionId);
        const entry = {
            uuid: nanoid(),
            parentUuid,
            sessionId,
            timestamp: new Date().toISOString(),
            type: 'tool_result',
            cwd: this.projectPath,
            gitBranch: detectGitBranch(this.projectPath),
            version: this.version,
            message: {
                role: 'assistant',
                content: '',
            },
            toolResult: {
                id: toolId,
                output,
                error,
            },
        };
        await store.append(entry);
        return entry.uuid;
    }
    /**
     *
     */
    async saveCompaction(sessionId, summary, metadata, parentUuid = null) {
        const store = this.getStore(sessionId);
        // 1. 保存压缩边界标
        const boundaryEntry = {
            uuid: nanoid(),
            parentUuid,
            sessionId,
            timestamp: new Date().toISOString(),
            type: 'system',
            subtype: 'compact_boundary',
            cwd: this.projectPath,
            gitBranch: detectGitBranch(this.projectPath),
            version: this.version,
            message: {
                role: 'system',
                content: '=== 上下文压缩边界 ===',
            },
            compactMetadata: metadata,
        };
        await store.append(boundaryEntry);
        // 2. 保存压缩总
        const summaryEntry = {
            uuid: nanoid(),
            parentUuid: boundaryEntry.uuid,
            sessionId,
            timestamp: new Date().toISOString(),
            type: 'user',
            isCompactSummary: true,
            cwd: this.projectPath,
            version: this.version,
            message: {
                role: 'user',
                content: summary,
            },
            compactMetadata: metadata,
        };
        await store.append(summaryEntry);
        return summaryEntry.uuid;
    }
    /**
     *
     */
    async loadSession(sessionId) {
        const store = this.getStore(sessionId);
        if (!store.exists()) {
            return null;
        }
        const entries = await store.readAll();
        if (entries.length === 0) {
            return null;
        }
        const firstEntry = entries[0];
        return {
            sessionId,
            preferences: {},
            startTime: new Date(firstEntry.timestamp).getTime(),
        };
    }
    /**
     *
     */
    async loadConversation(sessionId) {
        const store = this.getStore(sessionId);
        if (!store.exists()) {
            return null;
        }
        // 只加载压缩边界后的消
        const entries = await store.readAfterCompaction();
        const messages = [];
        let lastActivity = 0;
        for (const entry of entries) {
            const timestamp = new Date(entry.timestamp).getTime();
            if (timestamp > lastActivity) {
                lastActivity = timestamp;
            }
            // 跳过压缩边
            if (entry.subtype === 'compact_boundary') {
                continue;
            }
            // 转换
            if (entry.type === 'user' || entry.type === 'assistant' || entry.type === 'system') {
                messages.push({
                    id: entry.uuid,
                    role: entry.message.role,
                    content: typeof entry.message.content === 'string'
                        ? entry.message.content
                        : JSON.stringify(entry.message.content),
                    timestamp,
                    metadata: entry.isCompactSummary ? { isCompactSummary: true } : undefined,
                });
            }
        }
        return {
            messages,
            topics: [],
            lastActivity,
        };
    }
    /**
     *
     */
    async listSessions() {
        const { readdir } = await import('node:fs/promises');
        const { getProjectStoragePath } = await import('./pathUtils.js');
        const storagePath = getProjectStoragePath(this.projectPath);
        try {
            const files = await readdir(storagePath);
            return files
                .filter(f => f.endsWith('.jsonl'))
                .map(f => f.replace('.jsonl', ''));
        }
        catch {
            return [];
        }
    }
    /**
     *
     */
    async deleteSession(sessionId) {
        const store = this.getStore(sessionId);
        await store.delete();
    }
    /**
     *
     */
    async getSessionStats(sessionId) {
        const store = this.getStore(sessionId);
        if (!store.exists()) {
            return null;
        }
        const entries = await store.readAll();
        const fileSize = await store.getFileSize();
        if (entries.length === 0) {
            return {
                messageCount: 0,
                fileSize,
                createdAt: null,
                lastUpdatedAt: null,
            };
        }
        return {
            messageCount: entries.length,
            fileSize,
            createdAt: new Date(entries[0].timestamp),
            lastUpdatedAt: new Date(entries[entries.length - 1].timestamp),
        };
    }
}
//# sourceMappingURL=PersistentStore.js.map