/**
 *
 *
 *
 */
import { nanoid } from 'nanoid';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { MemoryStore, PersistentStore, CacheStore, getStorageRoot, detectGitBranch, detectGitRemote } from './storage/index.js';
import { TokenCounter } from './TokenCounter.js';
import { CompactionService } from './CompactionService.js';
export class ContextManager {
    memory;
    persistent;
    cache;
    options;
    currentSessionId = null;
    pendingSaves = [];
    constructor(options = {}) {
        // 默认配
        this.options = {
            storage: {
                maxMemorySize: 1000,
                persistentPath: getStorageRoot(),
                cacheSize: 100,
                compressionEnabled: true,
                ...options.storage,
            },
            defaultFilter: {
                maxTokens: 32000,
                maxMessages: 50,
                timeWindow: 24 * 60 * 60 * 1000, // 24小
                ...options.defaultFilter,
            },
            compressionThreshold: options.compressionThreshold || 100000, // 100k tokens
        };
        // 初始化存储
        this.memory = new MemoryStore(this.options.storage.maxMemorySize);
        this.persistent = new PersistentStore(process.cwd(), 100);
        this.cache = new CacheStore(this.options.storage.cacheSize, 5 * 60 * 1000);
    }
    /**
     *
     */
    async createSession(userId, preferences = {}, configuration = {}) {
        // 使用 nanoid 生成会话 ID，或使用提供
        const sessionId = configuration.sessionId || nanoid();
        const now = Date.now();
        // 创建初始上下
        const contextData = {
            layers: {
                system: await this.createSystemContext(),
                session: {
                    sessionId,
                    userId,
                    preferences,
                    configuration,
                    startTime: now,
                },
                conversation: {
                    messages: [],
                    topics: [],
                    lastActivity: now,
                },
                tool: {
                    recentCalls: [],
                    toolStates: {},
                    dependencies: {},
                },
                workspace: await this.createWorkspaceContext(),
            },
            metadata: {
                totalTokens: 0,
                priority: 1,
                lastUpdated: now,
            },
        };
        // 存储到内
        this.memory.setContext(contextData);
        this.currentSessionId = sessionId;
        return sessionId;
    }
    /**
     *
     */
    async createSystemContext() {
        return {
            osType: os.type(),
            osVersion: os.release(),
            shell: process.env.SHELL || 'unknown',
            nodeVersion: process.version,
            cwd: process.cwd(),
        };
    }
    /**
     *
     */
    async createWorkspaceContext() {
        const projectPath = process.cwd();
        // 尝试读
        let packageJson;
        try {
            const { readFile } = await import('node:fs/promises');
            const { join } = await import('node:path');
            const content = await readFile(join(projectPath, 'package.json'), 'utf-8');
            const pkg = JSON.parse(content);
            packageJson = {
                name: pkg.name,
                version: pkg.version,
                dependencies: pkg.dependencies,
            };
        }
        catch {
            // 忽略错
        }
        return {
            projectPath,
            gitBranch: detectGitBranch(projectPath),
            gitRemote: detectGitRemote(projectPath),
            packageJson,
        };
    }
    /**
     *
     */
    async addMessage(role, content, metadata) {
        if (!this.currentSessionId) {
            throw new Error('没有活动会话');
        }
        const message = {
            id: nanoid(),
            role,
            content,
            timestamp: Date.now(),
            metadata,
        };
        // 添加到内
        this.memory.addMessage(message);
        // 检查是否需要压
        const contextData = this.memory.getContext();
        if (contextData && this.shouldCompress(contextData)) {
            await this.compressCurrentContext();
        }
        // 持久化保存到 JSONL 文件
        await this.saveMessagePersist(message);
    }
    /**
     *
     */
    shouldCompress(contextData) {
        return contextData.metadata.totalTokens > this.options.compressionThreshold;
    }
    /**
     * Persist message to JSONL synchronously (awaited by the caller).
     * The promise is tracked so cleanup() can flush before exit.
     */
    async saveMessagePersist(message) {
        if (!this.currentSessionId)
            return;
        const promise = this.persistent.saveMessage(this.currentSessionId, message.role, message.content, null, message.metadata).catch(error => {
            console.error('[ContextManager] 保存消息失败:', error);
        });
        this.pendingSaves.push(promise);
        await promise;
    }
    /**
     * Flush all pending saves — call before exit to ensure no data loss.
     */
    async flush() {
        const pending = [...this.pendingSaves];
        this.pendingSaves.length = 0;
        await Promise.all(pending);
    }
    /**
     *
     */
    async compressCurrentContext() {
        const contextData = this.memory.getContext();
        if (!contextData) {
            return null;
        }
        const messages = contextData.layers.conversation.messages.map(m => ({
            role: m.role,
            content: m.content,
        }));
        const result = await CompactionService.compact(messages, {
            trigger: 'auto',
            modelName: (() => {
                try {
                    const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.aegiscode', 'config.json'), 'utf8'));
                    return cfg?.default?.model || 'claude-sonnet-4-6';
                }
                catch {
                    return 'claude-sonnet-4-6';
                }
            })(),
            maxContextTokens: this.options.compressionThreshold,
        });
        if (result.success) {
            // 更新内存中的消
            const newMessages = result.compactedMessages.map(m => ({
                id: nanoid(),
                role: m.role,
                content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
                timestamp: Date.now(),
            }));
            this.memory.setMessages(newMessages);
            this.memory.updateTokenCount(result.postTokens);
            // 保存压缩记
            if (this.currentSessionId) {
                await this.persistent.saveCompaction(this.currentSessionId, result.summary, {
                    trigger: 'auto',
                    preTokens: result.preTokens,
                    postTokens: result.postTokens,
                    filesIncluded: result.filesIncluded,
                });
            }
        }
        return result;
    }
    /**
     *
     */
    async manualCompact() {
        const contextData = this.memory.getContext();
        if (!contextData) {
            return null;
        }
        const messages = contextData.layers.conversation.messages.map(m => ({
            role: m.role,
            content: m.content,
        }));
        const result = await CompactionService.compact(messages, {
            trigger: 'manual',
            modelName: 'claude-sonnet-4-6',
            maxContextTokens: this.options.compressionThreshold,
        });
        if (result.success) {
            const newMessages = result.compactedMessages.map(m => ({
                id: nanoid(),
                role: m.role,
                content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
                timestamp: Date.now(),
            }));
            this.memory.setMessages(newMessages);
            this.memory.updateTokenCount(result.postTokens);
            if (this.currentSessionId) {
                await this.persistent.saveCompaction(this.currentSessionId, result.summary, {
                    trigger: 'manual',
                    preTokens: result.preTokens,
                    postTokens: result.postTokens,
                    filesIncluded: result.filesIncluded,
                });
            }
        }
        return result;
    }
    /**
     *
     */
    async loadSession(sessionId) {
        try {
            // 先尝试从内存加
            let contextData = this.memory.getContext();
            if (!contextData || contextData.layers.session.sessionId !== sessionId) {
                // 从持久化存储加
                const [session, conversation] = await Promise.all([
                    this.persistent.loadSession(sessionId),
                    this.persistent.loadConversation(sessionId),
                ]);
                if (!session || !conversation) {
                    return false;
                }
                // 重建完整的上下文数
                contextData = {
                    layers: {
                        system: await this.createSystemContext(),
                        session,
                        conversation,
                        tool: { recentCalls: [], toolStates: {}, dependencies: {} },
                        workspace: await this.createWorkspaceContext(),
                    },
                    metadata: {
                        totalTokens: 0,
                        priority: 1,
                        lastUpdated: Date.now(),
                    },
                };
                this.memory.setContext(contextData);
            }
            this.currentSessionId = sessionId;
            return true;
        }
        catch (error) {
            console.error('[ContextManager] 加载会话失败:', error);
            return false;
        }
    }
    /**
     *
     */
    getCurrentSessionId() {
        return this.currentSessionId;
    }
    /**
     *
     */
    getContext() {
        return this.memory.getContext();
    }
    /**
     *
     */
    getMessages() {
        return this.memory.getMessages();
    }
    /**
     *
     */
    getTokenCount() {
        return this.memory.getTokenCount();
    }
    /**
     *
     */
    updateTokenCount(tokens) {
        this.memory.updateTokenCount(tokens);
    }
    /**
     *
     */
    replaceMessages(messages) {
        this.memory.setMessages(messages);
    }
    /**
     *
     */
    getCache(key) {
        return this.cache.get(key);
    }
    /**
     *
     */
    setCache(key, value, ttl) {
        this.cache.set(key, value, ttl);
    }
    /**
     *
     */
    async listSessions() {
        return this.persistent.listSessions();
    }
    /**
     *
     */
    async deleteSession(sessionId) {
        await this.persistent.deleteSession(sessionId);
        if (this.currentSessionId === sessionId) {
            this.memory.clear();
            this.currentSessionId = null;
        }
    }
    /**
     *
     */
    async cleanup() {
        await this.flush();
        this.memory.clear();
        this.cache.clear();
        TokenCounter.clearCache();
    }
}
//# sourceMappingURL=ContextManager.js.map