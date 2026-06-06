/**
 * 
 */

import { TokenCounter } from './TokenCounter.js';
import { MemoryStore } from './storage/MemoryStore.js';
import { CacheStore } from './storage/CacheStore.js';
import { JSONLStore } from './storage/JSONLStore.js';
import { FileAnalyzer } from './FileAnalyzer.js';
import { CompactionService } from './CompactionService.js';
import { escapeProjectPath, getProjectStoragePath } from './storage/pathUtils.js';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import type { ContextData, ContextMessage, JSONLEntry } from './types.js';
import type { Message } from '../agent/types.js';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      passed++;
    } catch (error) {
      console.error('  ', error instanceof Error ? error.message : error);
      failed++;
    }
  })();
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTests() {
  await test('TokenCounter:  Token ', () => {
    const tokens = TokenCounter.estimateTokens('Hello, world!');
    assert(tokens > 0, 'Token  0');
  });

  await test('TokenCounter: ', () => {
    const text = 'Hello  World ';
    const tokens = TokenCounter.estimateTokens(text);
    assert(tokens > 0, 'Token  0');
  });

  await test('TokenCounter:  Token', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];
    const tokens = TokenCounter.countTokens(messages, 'claude-sonnet-4-20250514');
    assert(tokens > 0, 'Token  0');
  });

  await test('TokenCounter: shouldCompact ', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Hello' },
    ];
    const shouldCompact = TokenCounter.shouldCompact(messages, 'claude-sonnet-4-20250514', 100, 0.8);
    assert(!shouldCompact, '');
  });
  await test('MemoryStore: ', () => {
    const store = new MemoryStore(100);
    const contextData: ContextData = {
      layers: {
        system: { osType: 'test', osVersion: '1.0', shell: 'bash', nodeVersion: 'v18', cwd: '/' },
        session: { sessionId: 'test-123', preferences: {}, startTime: Date.now() },
        conversation: { messages: [], topics: [], lastActivity: Date.now() },
        tool: { recentCalls: [], toolStates: {}, dependencies: {} },
        workspace: { projectPath: '/' },
      },
      metadata: { totalTokens: 0, priority: 1, lastUpdated: Date.now() },
    };
    store.setContext(contextData);
    assert(store.hasData(), '');
    assert(store.getSessionId() === 'test-123', ' ID ');
  });

  await test('MemoryStore: ', () => {
    const store = new MemoryStore(100);
    const contextData: ContextData = {
      layers: {
        system: { osType: 'test', osVersion: '1.0', shell: 'bash', nodeVersion: 'v18', cwd: '/' },
        session: { sessionId: 'test', preferences: {}, startTime: Date.now() },
        conversation: { messages: [], topics: [], lastActivity: Date.now() },
        tool: { recentCalls: [], toolStates: {}, dependencies: {} },
        workspace: { projectPath: '/' },
      },
      metadata: { totalTokens: 0, priority: 1, lastUpdated: Date.now() },
    };
    store.setContext(contextData);

    const message: ContextMessage = {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
    };
    store.addMessage(message);

    const messages = store.getMessages();
    assert(messages.length === 1, ' 1 ');
    assert(messages[0].content === 'Hello', '');
  });

  await test('MemoryStore: ', () => {
    const store = new MemoryStore(5);
    const contextData: ContextData = {
      layers: {
        system: { osType: 'test', osVersion: '1.0', shell: 'bash', nodeVersion: 'v18', cwd: '/' },
        session: { sessionId: 'test', preferences: {}, startTime: Date.now() },
        conversation: { messages: [], topics: [], lastActivity: Date.now() },
        tool: { recentCalls: [], toolStates: {}, dependencies: {} },
        workspace: { projectPath: '/' },
      },
      metadata: { totalTokens: 0, priority: 1, lastUpdated: Date.now() },
    };
    store.setContext(contextData);
    for (let i = 0; i < 10; i++) {
      store.addMessage({
        id: `msg-${i}`,
        role: 'user',
        content: `Message ${i}`,
        timestamp: Date.now(),
      });
    }

    const messages = store.getMessages();
    assert(messages.length <= 5, '');
  });
  await test('CacheStore: ', () => {
    const cache = new CacheStore(10, 1000);
    cache.set('key1', 'value1');
    const value = cache.get<string>('key1');
    assert(value === 'value1', '');
  });

  await test('CacheStore: TTL ', async () => {
    const cache = new CacheStore(10, 50); // 50ms TTL
    cache.set('key1', 'value1');
    await new Promise(r => setTimeout(r, 100));
    const value = cache.get<string>('key1');
    assert(value === undefined, ' undefined');
  });

  await test('CacheStore: LRU ', () => {
    const cache = new CacheStore(3, 10000);
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    cache.get('key2');
    cache.get('key3');
    cache.set('key4', 'value4');
    
    assert(cache.has('key2'), 'key2 ');
    assert(cache.has('key3'), 'key3 ');
    assert(cache.has('key4'), 'key4 ');
  });
  await test('pathUtils: escapeProjectPath', () => {
    const escaped = escapeProjectPath('/Users/foo/project');
    assert(!escaped.includes('/'), '');
    assert(escaped.includes('Users'), ' Users');
  });

  await test('pathUtils: getProjectStoragePath', () => {
    const storagePath = getProjectStoragePath('/Users/foo/project');
    assert(storagePath.includes('.aegis'), ' .aegis');
    assert(storagePath.includes('projects'), ' projects');
  });
  const testDir = path.join(os.tmpdir(), 'aegis-test-' + Date.now());
  const testFile = path.join(testDir, 'test.jsonl');

  await test('JSONLStore: ', async () => {
    const store = new JSONLStore(testFile);
    
    const entry: JSONLEntry = {
      uuid: 'test-uuid',
      parentUuid: null,
      sessionId: 'test-session',
      timestamp: new Date().toISOString(),
      type: 'user',
      cwd: '/test',
      version: '0.1.0',
      message: { role: 'user', content: 'Hello' },
    };

    await store.append(entry);
    const entries = await store.readAll();
    
    assert(entries.length === 1, ' 1 ');
    assert(entries[0].uuid === 'test-uuid', 'UUID ');
  });

  await test('JSONLStore: ', async () => {
    const store = new JSONLStore(testFile);
    
    const entries: JSONLEntry[] = [
      {
        uuid: 'batch-1',
        parentUuid: null,
        sessionId: 'test-session',
        timestamp: new Date().toISOString(),
        type: 'user',
        cwd: '/test',
        version: '0.1.0',
        message: { role: 'user', content: 'Message 1' },
      },
      {
        uuid: 'batch-2',
        parentUuid: 'batch-1',
        sessionId: 'test-session',
        timestamp: new Date().toISOString(),
        type: 'assistant',
        cwd: '/test',
        version: '0.1.0',
        message: { role: 'assistant', content: 'Message 2' },
      },
    ];

    await store.appendBatch(entries);
    const all = await store.readAll();
    assert(all.length === 3, ' 3 ');
  });
  await test('FileAnalyzer: ', () => {
    const messages: Message[] = [
      { role: 'user', content: ' src/index.ts ' },
      { role: 'assistant', content: '，', tool_calls: [
        { id: 'tc1', type: 'function', function: { name: 'Read', arguments: JSON.stringify({ file_path: 'src/index.ts' }) } }
      ]},
    ];

    const fileRefs = FileAnalyzer.analyzeFiles(messages);
    assert(Array.isArray(fileRefs), '');
  });
  await test('CompactionService: shouldCompact', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Hello' },
    ];
    const should = CompactionService.shouldCompact(messages, 'claude-sonnet-4-20250514', 100000);
    assert(!should, '');
  });

  await test('CompactionService: ', async () => {
    const messages: Message[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ];

    const result = await CompactionService.compact(messages, {
      trigger: 'manual',
      modelName: 'claude-sonnet-4-20250514',
      maxContextTokens: 100000,
    });

    assert(result.compactedMessages.length > 0, '');
    assert(result.preTokens > 0, ' Token ');
  });
  try {
    await fs.rm(testDir, { recursive: true });
  } catch {
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
