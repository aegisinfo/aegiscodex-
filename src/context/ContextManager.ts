/**
 * 
 * 
 * 
 */

import { nanoid } from 'nanoid';
import * as os from 'node:os';
import type {
  ContextData,
  ContextMessage,
  ContextManagerOptions,
  SystemContext,
  WorkspaceContext,
  CompactionResult,
} from './types.js';
import { MemoryStore, PersistentStore, CacheStore, getStorageRoot, detectGitBranch, detectGitRemote } from './storage/index.js';
import { TokenCounter } from './TokenCounter.js';
import { CompactionService } from './CompactionService.js';

export class ContextManager {
  private readonly memory: MemoryStore;
  private readonly persistent: PersistentStore;
  private readonly cache: CacheStore;
  private readonly options: ContextManagerOptions;

  private currentSessionId: string | null = null;

  constructor(options: Partial<ContextManagerOptions> = {}) {
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
        timeWindow: 24 * 60 * 60 * 1000,
        ...options.defaultFilter,
      },
      compressionThreshold: options.compressionThreshold || 100000, // 100k tokens
    };
    this.memory = new MemoryStore(this.options.storage.maxMemorySize);
    this.persistent = new PersistentStore(process.cwd(), 100);
    this.cache = new CacheStore(this.options.storage.cacheSize, 5 * 60 * 1000);
  }

  /**
   * 
   */
  async createSession(
    userId?: string,
    preferences: Record<string, unknown> = {},
    configuration: Record<string, unknown> = {}
  ): Promise<string> {
    const sessionId = (configuration.sessionId as string) || nanoid();
    const now = Date.now();
    const contextData: ContextData = {
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
    this.memory.setContext(contextData);

    this.currentSessionId = sessionId;
    return sessionId;
  }

  /**
   * 
   */
  private async createSystemContext(): Promise<SystemContext> {
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
  private async createWorkspaceContext(): Promise<WorkspaceContext> {
    const projectPath = process.cwd();
    let packageJson: WorkspaceContext['packageJson'];
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
    } catch {
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
  async addMessage(
    role: ContextMessage['role'],
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error('');
    }

    const message: ContextMessage = {
      id: nanoid(),
      role,
      content,
      timestamp: Date.now(),
      metadata,
    };
    this.memory.addMessage(message);
    const contextData = this.memory.getContext();
    if (contextData && this.shouldCompress(contextData)) {
      await this.compressCurrentContext();
    }
    this.saveMessageAsync(message);
  }

  /**
   * 
   */
  private shouldCompress(contextData: ContextData): boolean {
    return contextData.metadata.totalTokens > this.options.compressionThreshold;
  }

  /**
   * 
   */
  private saveMessageAsync(message: ContextMessage): void {
    if (!this.currentSessionId) return;
    setImmediate(async () => {
      try {
        await this.persistent.saveMessage(
          this.currentSessionId!,
          message.role as 'user' | 'assistant' | 'system',
          message.content,
          null,
          message.metadata as any
        );
      } catch (error) {
        console.error('[ContextManager] :', error);
      }
    });
  }

  /**
   * 
   */
  async compressCurrentContext(): Promise<CompactionResult | null> {
    const contextData = this.memory.getContext();
    if (!contextData) {
      return null;
    }

    const messages = contextData.layers.conversation.messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system' | 'tool',
      content: m.content,
    }));

    const result = await CompactionService.compact(messages, {
      trigger: 'auto',
      modelName: (() => {
        try {
          const fs = require('fs'), os = require('os'), path = require('path');
          const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.aegiscode', 'config.json'), 'utf8'));
          return cfg?.default?.model || 'claude-sonnet-4-20250514';
        } catch { return 'claude-sonnet-4-20250514'; }
      })(),
      maxContextTokens: this.options.compressionThreshold,
    });

    if (result.success) {
      const newMessages: ContextMessage[] = result.compactedMessages.map(m => ({
        id: nanoid(),
        role: m.role as ContextMessage['role'],
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        timestamp: Date.now(),
      }));

      this.memory.setMessages(newMessages);
      this.memory.updateTokenCount(result.postTokens);
      if (this.currentSessionId) {
        await this.persistent.saveCompaction(
          this.currentSessionId,
          result.summary,
          {
            trigger: 'auto',
            preTokens: result.preTokens,
            postTokens: result.postTokens,
            filesIncluded: result.filesIncluded,
          }
        );
      }
    }

    return result;
  }

  /**
   * 
   */
  async manualCompact(): Promise<CompactionResult | null> {
    const contextData = this.memory.getContext();
    if (!contextData) {
      return null;
    }

    const messages = contextData.layers.conversation.messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system' | 'tool',
      content: m.content,
    }));

    const result = await CompactionService.compact(messages, {
      trigger: 'manual',
      modelName: 'claude-sonnet-4-20250514',
      maxContextTokens: this.options.compressionThreshold,
    });

    if (result.success) {
      const newMessages: ContextMessage[] = result.compactedMessages.map(m => ({
        id: nanoid(),
        role: m.role as ContextMessage['role'],
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        timestamp: Date.now(),
      }));

      this.memory.setMessages(newMessages);
      this.memory.updateTokenCount(result.postTokens);

      if (this.currentSessionId) {
        await this.persistent.saveCompaction(
          this.currentSessionId,
          result.summary,
          {
            trigger: 'manual',
            preTokens: result.preTokens,
            postTokens: result.postTokens,
            filesIncluded: result.filesIncluded,
          }
        );
      }
    }

    return result;
  }

  /**
   * 
   */
  async loadSession(sessionId: string): Promise<boolean> {
    try {
      let contextData = this.memory.getContext();

      if (!contextData || contextData.layers.session.sessionId !== sessionId) {
        const [session, conversation] = await Promise.all([
          this.persistent.loadSession(sessionId),
          this.persistent.loadConversation(sessionId),
        ]);

        if (!session || !conversation) {
          return false;
        }
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
    } catch (error) {
      console.error('[ContextManager] :', error);
      return false;
    }
  }

  /**
   * 
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * 
   */
  getContext(): ContextData | null {
    return this.memory.getContext();
  }

  /**
   * 
   */
  getMessages(): ContextMessage[] {
    return this.memory.getMessages();
  }

  /**
   * 
   */
  getTokenCount(): number {
    return this.memory.getTokenCount();
  }

  /**
   * 
   */
  updateTokenCount(tokens: number): void {
    this.memory.updateTokenCount(tokens);
  }

  /**
   * 
   */
  replaceMessages(messages: ContextMessage[]): void {
    this.memory.setMessages(messages);
  }

  /**
   * 
   */
  getCache<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  /**
   * 
   */
  setCache<T>(key: string, value: T, ttl?: number): void {
    this.cache.set(key, value, ttl);
  }

  /**
   * 
   */
  async listSessions(): Promise<string[]> {
    return this.persistent.listSessions();
  }

  /**
   * 
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.persistent.deleteSession(sessionId);
    
    if (this.currentSessionId === sessionId) {
      this.memory.clear();
      this.currentSessionId = null;
    }
  }

  /**
   * 
   */
  cleanup(): void {
    this.memory.clear();
    this.cache.clear();
    TokenCounter.clearCache();
  }
}
