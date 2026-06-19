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
import type { SessionMessage, ToolCallStatus, ContentBlock } from './types.js';
import type { AnthropicStreamEvent } from '../services/streaming/types.js';
/**
 * Check if a message IS the currently active streaming message (by ref).
 * This is used by the RAF loop to efficiently skip non-streaming messages.
 */
export declare function isActiveStreamingMessage(msg: SessionMessage): boolean;
/**
 * Get direct reference to current streaming content.
 * Returns null if no streaming is active.
 */
export declare function getStreamingContent(): {
    content: string;
    thinking: string;
} | null;
/**
 * Get streaming content blocks synthesized from the current buffer state.
 * Returns TextBlock and ThinkingBlock objects representing in-flight content,
 * plus any accumulated tool_use blocks.
 *
 * These are merged with store content blocks in MessageList for structured rendering.
 */
export declare function getStreamingContentBlocks(): ContentBlock[];
/**
 * Apply a raw Anthropic-format streaming event.
 *
 * This is the primary entry point for the main chat path. It feeds the
 * TranscriptBuffer (rich segment model) and simultaneously updates the
 * mutable content/thinking strings (for drain/flush compat) and the
 * toolCalls map (for arg accumulation before store flush).
 *
 * Legacy paths (slash commands) continue using appendToBuffer /
 * appendThinkingToBuffer directly and bypass the TranscriptBuffer.
 */
export declare function applyStreamEvent(event: AnthropicStreamEvent): void;
/**
 * Initialize buffer for a new streaming message.
 * When called with the same ID as the current message (flush cycle),
 * only the content/thinking strings are reset — tool calls are preserved
 * so arg accumulation survives mid-stream flushes.
 */
export declare function initStreamingBuffer(messageId: string): void;
/**
 * Append content delta to the mutable buffer (NO store update).
 * Tracks as 'text' content block if we're in a text block.
 */
/**
 * Get the time (ms) since the last content was written to the buffer.
 * Returns 0 if no streaming is active.
 */
export declare function getStreamingLatencyMs(): number;
export declare function appendToBuffer(contentDelta: string): void;
/**
 * Append thinking delta to the mutable buffer (NO store update).
 * Tracks as 'thinking' content block.
 */
export declare function appendThinkingToBuffer(thinkingDelta: string): void;
/**
 * Signal the start of a tool_use block. Records the tool call ID and name.
 */
export declare function startToolCallInBuffer(toolCallId: string, name: string): void;
/**
 * Accumulate tool call arguments JSON delta.
 */
export declare function appendToolCallDelta(toolCallId: string, argumentsDelta: string): void;
/**
 * Mark a tool call as completed (success or error).
 */
export declare function finishToolCallInBuffer(toolCallId: string, isError: boolean): void;
/**
 * Get tool calls accumulated in the buffer.
 */
export declare function getBufferedToolCalls(): Array<{
    id: string;
    name: string;
    arguments: string;
    status: ToolCallStatus;
}>;
/**
 * Clear the buffer (e.g., on error/abort or after finishStreamingMessage).
 */
export declare function clearBuffer(): void;
/**
 * Check if buffer has content.
 */
export declare function hasBufferContent(): boolean;
/**
 * Peek at current content without clearing.
 */
export declare function peekBuffer(): {
    content: string;
    thinking: string;
    currentBlockType: string | null;
    currentBlockContent: string;
    toolCalls: Array<{
        id: string;
        name: string;
        arguments: string;
        status: ToolCallStatus;
    }>;
};
/**
 * Drain accumulated content block from the buffer.
 * Returns the block data and resets the accumulator.
 */
export declare function drainContentBlock(): {
    type: 'text' | 'thinking';
    content: string;
} | null;
/**
 * Drain tool calls from the buffer.
 */
export declare function drainToolCalls(): Array<{
    id: string;
    name: string;
    arguments: string;
    status: ToolCallStatus;
}>;
/**
 * Drain ALL content from the buffer and return it.
 * Clears the buffer entirely. Used by flushStreamBuffer and finishStreamingMessage.
 *
 * This is the SINGLE function that removes content from the buffer.
 * After calling it, the buffer is empty and ready for new content.
 *
 * Returns null if buffer is empty (no messageId set or no content).
 */
export declare function drainBuffer(): {
    content: string;
    thinking: string;
    toolCalls: Array<{
        id: string;
        name: string;
        arguments: string;
        status: ToolCallStatus;
    }>;
} | null;
/**
 * Start collecting mutations into a batch.
 */
export declare function startBatch(): void;
/**
 * Queue a user message in the current batch.
 */
export declare function batchAddUserMessage(content: string): void;
/**
 * Queue an assistant message in the current batch.
 */
export declare function batchAddAssistantMessage(content: string): void;
/**
 * Queue a thinking state change in the current batch.
 */
export declare function batchSetThinking(isThinking: boolean): void;
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
export declare function flushBatchWithStore(store: any): boolean;
/**
 * Cancel the current batch (e.g., on error before flush).
 */
export declare function cancelBatch(): void;
//# sourceMappingURL=streaming-buffer.d.ts.map