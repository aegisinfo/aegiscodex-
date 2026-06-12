/**
 * Streaming Buffer - external mutable buffer for streaming content.
 *
 * This completely bypasses the zustand store during streaming deltas.
 * Instead of calling set() on every flush (which triggers React re-renders
 * across all store subscribers), we write directly to a mutable buffer.
 * The MessageList RAF loop reads from this buffer directly.
 *
 * Only start/finish streaming and explicit flushes update the store.
 *
 * Supports Content Block model (Claude-style): text, thinking, tool_use, tool_result.
 */

import type { SessionMessage, ToolCallStatus } from './types.js';

// Shared mutable state for the currently streaming message
interface StreamingState {
  messageId: string | null;
  content: string;
  thinking: string;
  // Content block tracking
  currentBlockType: 'text' | 'thinking' | null;
  currentBlockAccumulator: string;
  toolCalls: Map<string, { name: string; arguments: string; status: ToolCallStatus }>;
}

const streamingState: StreamingState = {
  messageId: null,
  content: '',
  thinking: '',
  currentBlockType: null,
  currentBlockAccumulator: '',
  toolCalls: new Map(),
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
  streamingState.currentBlockType = null;
  streamingState.currentBlockAccumulator = '';
  streamingState.toolCalls.clear();
}

/**
 * Append content delta to the mutable buffer (NO store update).
 * Tracks as 'text' content block if we're in a text block.
 */
export function appendToBuffer(contentDelta: string): void {
  streamingState.content += contentDelta;
  // Track as text block
  streamingState.currentBlockType = 'text';
  streamingState.currentBlockAccumulator += contentDelta;
}

/**
 * Append thinking delta to the mutable buffer (NO store update).
 * Tracks as 'thinking' content block.
 */
export function appendThinkingToBuffer(thinkingDelta: string): void {
  streamingState.thinking += thinkingDelta;
  streamingState.currentBlockType = 'thinking';
  streamingState.currentBlockAccumulator += thinkingDelta;
}

/**
 * Signal the start of a tool_use block. Records the tool call ID and name.
 */
export function startToolCallInBuffer(toolCallId: string, name: string): void {
  streamingState.toolCalls.set(toolCallId, { name, arguments: '', status: 'running' });
}

/**
 * Accumulate tool call arguments JSON delta.
 */
export function appendToolCallDelta(toolCallId: string, argumentsDelta: string): void {
  const existing = streamingState.toolCalls.get(toolCallId);
  if (existing) {
    existing.arguments += argumentsDelta;
  }
}

/**
 * Mark a tool call as completed (success or error).
 */
export function finishToolCallInBuffer(toolCallId: string, isError: boolean): void {
  const existing = streamingState.toolCalls.get(toolCallId);
  if (existing) {
    existing.status = isError ? 'error' : 'success';
  }
}

/**
 * Get tool calls accumulated in the buffer.
 */
export function getBufferedToolCalls(): Array<{ id: string; name: string; arguments: string; status: ToolCallStatus }> {
  return Array.from(streamingState.toolCalls.entries()).map(([id, tc]) => ({
    id,
    ...tc,
  }));
}

/**
 * Clear the buffer (e.g., on error/abort).
 */
export function clearBuffer(): void {
  streamingState.messageId = null;
  streamingState.content = '';
  streamingState.thinking = '';
  streamingState.currentBlockType = null;
  streamingState.currentBlockAccumulator = '';
  streamingState.toolCalls.clear();
}

/**
 * Check if buffer has content.
 */
export function hasBufferContent(): boolean {
  return streamingState.content.length > 0 || streamingState.thinking.length > 0 || streamingState.toolCalls.size > 0;
}

/**
 * Peek at current content without clearing.
 */
export function peekBuffer(): { content: string; thinking: string; currentBlockType: string | null; currentBlockContent: string; toolCalls: Array<{ id: string; name: string; arguments: string; status: ToolCallStatus }> } {
  return {
    content: streamingState.content,
    thinking: streamingState.thinking,
    currentBlockType: streamingState.currentBlockType,
    currentBlockContent: streamingState.currentBlockAccumulator,
    toolCalls: getBufferedToolCalls(),
  };
}

/**
 * Drain accumulated content block from the buffer.
 * Returns the block data and resets the accumulator.
 */
export function drainContentBlock(): { type: 'text' | 'thinking'; content: string } | null {
  if (!streamingState.currentBlockType || !streamingState.currentBlockAccumulator) {
    return null;
  }
  const block = {
    type: streamingState.currentBlockType as 'text' | 'thinking',
    content: streamingState.currentBlockAccumulator,
  };
  streamingState.currentBlockType = null;
  streamingState.currentBlockAccumulator = '';
  return block;
}

/**
 * Drain tool calls from the buffer.
 */
export function drainToolCalls(): Array<{ id: string; name: string; arguments: string; status: ToolCallStatus }> {
  const calls = getBufferedToolCalls();
  streamingState.toolCalls.clear();
  return calls;
}

/**
 * Drain ALL content from the buffer and return it.
 * Clears the buffer entirely. Used by flushStreamBuffer and finishStreamingMessage.
 *
 * This is the SINGLE function that removes content from the buffer.
 * After calling it, the buffer is empty and ready for new content.
 *
 * Returns null if buffer is empty (no messageId set or no content).
 */
export function drainBuffer(): { content: string; thinking: string; toolCalls: Array<{ id: string; name: string; arguments: string; status: ToolCallStatus }> } | null {
  if (!streamingState.messageId) return null;
  if (!streamingState.content && !streamingState.thinking && streamingState.toolCalls.size === 0) return null;

  const result = {
    content: streamingState.content,
    thinking: streamingState.thinking,
    toolCalls: getBufferedToolCalls(),
  };

  // Clear all content but KEEP messageId so isActiveStreamingMessage still works
  streamingState.content = '';
  streamingState.thinking = '';
  streamingState.currentBlockType = null;
  streamingState.currentBlockAccumulator = '';
  streamingState.toolCalls.clear();

  return result;
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
