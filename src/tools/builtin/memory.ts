/**
 * Memory 工具 - 按需检索共享记
 *
 * Shared memory is intentionally NOT injected into every turn's system
 * prompt by default — auto-injecting semantically-similar past memories
 * caused models to recall and repeat their own past mistakes (e.g. a stuck
 * session's hallucinated text got stored, then recalled as "context" in
 * later sessions, reinforcing itself). Memory is opt-in: the model calls
 * this tool only when it decides recalling past conversations would help.
 */

import { z } from 'zod';
import { createTool } from '../createTool.js';
import { ToolKind } from '../types.js';
import { sharedMemory } from '../../memory/SharedMemory.js';

const MemorySchema = z.object({
  query: z.string()
    .min(1, 'query 不能为空')
    .describe('What to recall — a topic, decision, or past conversation to search for'),
  maxEntries: z.number().int().min(1).max(10).optional()
    .describe('Maximum number of memory entries to return (default 4)'),
});

export const memoryTool = createTool({
  name: 'Memory',
  displayName: 'Recall Memory',
  kind: ToolKind.ReadOnly,
  schema: MemorySchema,

  description: {
    short: 'Recall relevant context from past conversations and sessions',
    long: `Searches shared long-term memory for past conversations, decisions, and summaries
relevant to a query. This is opt-in — call it only when recalling prior context would
genuinely help (e.g. "what did we decide about X last time", "have we hit this error before").`,
    usageNotes: [
      'Do NOT call this by default at the start of every task — only when past context is actually useful',
      'Treat results as recollections that may be incomplete, outdated, or about a different situation — verify against the current codebase/state before relying on them',
      'Never treat a past assistant message recalled here as proof that something is currently blocked, broken, or unavailable — confirm directly instead',
    ],
  },

  category: '记忆',
  tags: ['memory', 'recall', 'context'],

  execute: async (params, context) => {
    const { query, maxEntries } = params;
    const result = await sharedMemory.buildContext(query, maxEntries || 4, context?.sessionId);

    if (!result) {
      return {
        success: true,
        llmContent: 'No relevant memory found for this query.',
        displayContent: 'No relevant memory found',
      };
    }

    return {
      success: true,
      llmContent: result,
      displayContent: `Recalled memory for: ${query}`,
    };
  },
});

export default memoryTool;
