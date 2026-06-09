/**
 * Streaming Buffer - external mutable buffer for streaming content.
 *
 * This completely bypasses the zustand store during streaming deltas.
 * Instead of calling set() on every flush (which triggers React re-renders
 * across all store subscribers), we write directly to a mutable buffer.
 * The MessageList RAF loop reads from this buffer directly.
 *
 * Only start/finish streaming and explicit flushes update the store.
 */

import type { SessionMessage } from './types.js';

// Shared mutable state for the currently streaming message
interface StreamingState {
  messageId: string | null;
  content: string;
  thinking: string;
}

const streamingState: StreamingState = {
  messageId: null,
  content: '',
  thinking: '',
};

/**
 * Check if a message IS the currently active streaming message (by ref).
 * This is used by the RAF loop to efficiently skip non-streaming messages.
 */
export function isActiveStreamingMessage(msg: SessionMessage): boolean {
  return msg.id === streamingState.messageId;
}

/**
 * Get direct reference to current streaming content.
 * Returns null if no streaming is active.
 */
export function getStreamingContent(): { content: string; thinking: string } | null {
  if (!streamingState.messageId) return null;
  return {
    content: streamingState.content,
    thinking: streamingState.thinking,
  };
}

/**
 * Initialize buffer for a new streaming message.
 */
export function initStreamingBuffer(messageId: string): void {
  streamingState.messageId = messageId;
  streamingState.content = '';
  streamingState.thinking = '';
}

/**
 * Append content delta to the mutable buffer (NO store update).
 */
export function appendToBuffer(contentDelta: string): void {
  streamingState.content += contentDelta;
}

/**
 * Append thinking delta to the mutable buffer (NO store update).
 */
export function appendThinkingToBuffer(thinkingDelta: string): void {
  streamingState.thinking += thinkingDelta;
}

/**
 * Clear the buffer (e.g., on error/abort).
 */
export function clearBuffer(): void {
  streamingState.messageId = null;
  streamingState.content = '';
  streamingState.thinking = '';
}

/**
 * Check if buffer has content.
 */
export function hasBufferContent(): boolean {
  return streamingState.content.length > 0 || streamingState.thinking.length > 0;
}

/**
 * Peek at current content without clearing.
 */
export function peekBuffer(): { content: string; thinking: string } {
  return {
    content: streamingState.content,
    thinking: streamingState.thinking,
  };
}

// ==================== Batch Buffer for Slash Commands ====================
// Slash commands trigger multiple store updates (addUserMessage, setThinking, addAssistantMessage).
// Instead of each calling set() individually (causing cascading re-renders), we batch them:
// 1. Collect all mutations in a pending batch object
// 2. flushBatch() applies them as a single set() call
//
// The MessageList subscription already detects message count changes (see MessageList.tsx:128-133),
// so a single batch flush triggers exactly ONE re-render for the entire slash command result.

interface BatchUpdate {
  userMessage?: string;
  assistantMessage?: string;
  isThinking?: boolean;
}

let pendingBatch: BatchUpdate | null = null;

/**
 * Start collecting mutations into a batch.
 */
export function startBatch(): void {
  pendingBatch = {};
}

/**
 * Queue a user message in the current batch.
 */
export function batchAddUserMessage(content: string): void {
  if (pendingBatch) {
    pendingBatch.userMessage = content;
  }
}

/**
 * Queue an assistant message in the current batch.
 */
export function batchAddAssistantMessage(content: string): void {
  if (pendingBatch) {
    pendingBatch.assistantMessage = content;
  }
}

/**
 * Queue a thinking state change in the current batch.
 */
export function batchSetThinking(isThinking: boolean): void {
  if (pendingBatch) {
    pendingBatch.isThinking = isThinking;
  }
}

/**
 * Flush the batch: apply all queued mutations as a single set() call.
 * Accepts the store instance to avoid circular dependencies in ESM.
 *
 * Returns true if any mutations were applied.
 *
 * This is equivalent to calling:
 *   sessionActions().addUserMessage(...) + sessionActions().addAssistantMessage(...) + sessionActions().setThinking(...)
 * but done as a SINGLE setState call, eliminating cascading re-renders.
 */
export function flushBatchWithStore(store: any): boolean {
  if (!pendingBatch) return false;
  const batch = pendingBatch;
  pendingBatch = null;

  const hasUser = batch.userMessage !== undefined;
  const hasAssistant = batch.assistantMessage !== undefined;
  const hasThinking = batch.isThinking !== undefined;

  if (!hasUser && !hasAssistant && !hasThinking) return false;

  const current = store.getState().session;
  const newMessages = [...current.messages];
  const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  if (hasUser && batch.userMessage) {
    newMessages.push({
      id: `user-${generateId()}`,
      role: 'user' as const,
      content: batch.userMessage,
      timestamp: Date.now(),
    });
  }

  if (hasAssistant && batch.assistantMessage) {
    newMessages.push({
      id: `assistant-${generateId()}`,
      role: 'assistant' as const,
      content: batch.assistantMessage,
      timestamp: Date.now(),
    });
  }

  const update: any = { messages: newMessages };
  if (hasThinking) {
    update.isThinking = batch.isThinking;
  }

  store.setState((s: any) => ({
    session: { ...s.session, ...update },
  }));

  return true;
}

/**
 * Cancel the current batch (e.g., on error before flush).
 */
export function cancelBatch(): void {
  pendingBatch = null;
}
