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
import { TranscriptBuffer } from '../services/streaming/TranscriptBuffer.js';
import { parseStreamEvent } from '../services/streaming/StreamEventParser.js';
const streamingState = {
    messageId: null,
    content: '',
    thinking: '',
    currentBlockType: null,
    currentBlockAccumulator: '',
    toolCalls: new Map(),
    transcriptBuffer: new TranscriptBuffer({ showToolResults: false }),
    blockIndexToToolId: new Map(),
    lastWriteTimestamp: 0,
};
/**
 * Check if a message IS the currently active streaming message (by ref).
 * This is used by the RAF loop to efficiently skip non-streaming messages.
 */
export function isActiveStreamingMessage(msg) {
    return msg.id === streamingState.messageId;
}
/**
 * Get direct reference to current streaming content.
 * Returns null if no streaming is active.
 */
export function getStreamingContent() {
    if (!streamingState.messageId)
        return null;
    return {
        content: streamingState.content,
        thinking: streamingState.thinking,
    };
}
/**
 * Get streaming content blocks synthesized from the current buffer state.
 * Returns TextBlock and ThinkingBlock objects representing in-flight content,
 * plus any accumulated tool_use blocks.
 *
 * These are merged with store content blocks in MessageList for structured rendering.
 */
export function getStreamingContentBlocks() {
    const blocks = [];
    if (streamingState.thinking) {
        blocks.push({ type: 'thinking', thinking: streamingState.thinking });
    }
    if (streamingState.content) {
        blocks.push({ type: 'text', text: streamingState.content });
    }
    return blocks;
}
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
export function applyStreamEvent(event) {
    const parsed = parseStreamEvent(event);
    for (const e of parsed) {
        streamingState.transcriptBuffer.apply(e);
        if ((e.type === 'text_delta' || e.type === 'text_chunk') && e.text) {
            streamingState.content += e.text;
            streamingState.lastWriteTimestamp = Date.now();
            streamingState.currentBlockType = 'text';
            streamingState.currentBlockAccumulator += e.text;
        }
        if ((e.type === 'thinking_delta' || e.type === 'thinking_chunk') && e.text) {
            streamingState.thinking += e.text;
            streamingState.lastWriteTimestamp = Date.now();
            streamingState.currentBlockType = 'thinking';
            streamingState.currentBlockAccumulator += e.text;
        }
        if (e.type === 'tool_use_start' && e.id && e.name) {
            if (!streamingState.toolCalls.has(e.id)) {
                streamingState.toolCalls.set(e.id, { name: e.name, arguments: '', status: 'running' });
            }
            if (e.index !== undefined && e.index >= 0) {
                streamingState.blockIndexToToolId.set(e.index, e.id);
            }
        }
        if (e.type === 'tool_use_delta' && e.partial_json && e.index !== undefined) {
            const toolId = streamingState.blockIndexToToolId.get(e.index);
            if (toolId) {
                const tc = streamingState.toolCalls.get(toolId);
                if (tc)
                    tc.arguments += e.partial_json;
            }
        }
    }
}
/**
 * Initialize buffer for a new streaming message.
 * When called with the same ID as the current message (flush cycle),
 * only the content/thinking strings are reset — tool calls are preserved
 * so arg accumulation survives mid-stream flushes.
 */
export function initStreamingBuffer(messageId) {
    const isNewMessage = streamingState.messageId !== messageId;
    streamingState.messageId = messageId;
    streamingState.content = '';
    streamingState.thinking = '';
    streamingState.currentBlockType = null;
    streamingState.currentBlockAccumulator = '';
    if (isNewMessage) {
        streamingState.toolCalls.clear();
        streamingState.transcriptBuffer.clear();
        streamingState.blockIndexToToolId.clear();
    }
}
/**
 * Append content delta to the mutable buffer (NO store update).
 * Tracks as 'text' content block if we're in a text block.
 */
/**
 * Get the time (ms) since the last content was written to the buffer.
 * Returns 0 if no streaming is active.
 */
export function getStreamingLatencyMs() {
    if (!streamingState.messageId || streamingState.lastWriteTimestamp === 0)
        return 0;
    return Date.now() - streamingState.lastWriteTimestamp;
}
export function appendToBuffer(contentDelta) {
    streamingState.content += contentDelta;
    streamingState.lastWriteTimestamp = Date.now();
    // Track as text block
    streamingState.currentBlockType = 'text';
    streamingState.currentBlockAccumulator += contentDelta;
}
/**
 * Append thinking delta to the mutable buffer (NO store update).
 * Tracks as 'thinking' content block.
 */
export function appendThinkingToBuffer(thinkingDelta) {
    streamingState.thinking += thinkingDelta;
    streamingState.lastWriteTimestamp = Date.now();
    streamingState.currentBlockType = 'thinking';
    streamingState.currentBlockAccumulator += thinkingDelta;
}
/**
 * Signal the start of a tool_use block. Records the tool call ID and name.
 */
export function startToolCallInBuffer(toolCallId, name) {
    streamingState.toolCalls.set(toolCallId, { name, arguments: '', status: 'running' });
}
/**
 * Accumulate tool call arguments JSON delta.
 */
export function appendToolCallDelta(toolCallId, argumentsDelta) {
    const existing = streamingState.toolCalls.get(toolCallId);
    if (existing) {
        existing.arguments += argumentsDelta;
    }
}
/**
 * Mark a tool call as completed (success or error).
 */
export function finishToolCallInBuffer(toolCallId, isError) {
    const existing = streamingState.toolCalls.get(toolCallId);
    if (existing) {
        existing.status = isError ? 'error' : 'success';
    }
}
/**
 * Get tool calls accumulated in the buffer.
 */
export function getBufferedToolCalls() {
    return Array.from(streamingState.toolCalls.entries()).map(([id, tc]) => ({
        id,
        ...tc,
    }));
}
/**
 * Clear the buffer (e.g., on error/abort or after finishStreamingMessage).
 */
export function clearBuffer() {
    streamingState.messageId = null;
    streamingState.content = '';
    streamingState.thinking = '';
    streamingState.currentBlockType = null;
    streamingState.currentBlockAccumulator = '';
    streamingState.toolCalls.clear();
    streamingState.transcriptBuffer.clear();
    streamingState.blockIndexToToolId.clear();
    streamingState.lastWriteTimestamp = 0;
}
/**
 * Check if buffer has content.
 */
export function hasBufferContent() {
    return streamingState.content.length > 0 || streamingState.thinking.length > 0 || streamingState.toolCalls.size > 0;
}
/**
 * Peek at current content without clearing.
 */
export function peekBuffer() {
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
export function drainContentBlock() {
    if (!streamingState.currentBlockType || !streamingState.currentBlockAccumulator) {
        return null;
    }
    const block = {
        type: streamingState.currentBlockType,
        content: streamingState.currentBlockAccumulator,
    };
    streamingState.currentBlockType = null;
    streamingState.currentBlockAccumulator = '';
    return block;
}
/**
 * Drain tool calls from the buffer.
 */
export function drainToolCalls() {
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
export function drainBuffer() {
    if (!streamingState.messageId)
        return null;
    if (!streamingState.content && !streamingState.thinking && streamingState.toolCalls.size === 0)
        return null;
    const result = {
        content: streamingState.content,
        thinking: streamingState.thinking,
        toolCalls: getBufferedToolCalls(),
    };
    // Clear content but KEEP messageId (so isActiveStreamingMessage still works)
    // and KEEP toolCalls (they're still in-flight; cleared by clearBuffer after finish).
    streamingState.content = '';
    streamingState.thinking = '';
    streamingState.currentBlockType = null;
    streamingState.currentBlockAccumulator = '';
    return result;
}
let pendingBatch = null;
/**
 * Start collecting mutations into a batch.
 */
export function startBatch() {
    pendingBatch = {};
}
/**
 * Queue a user message in the current batch.
 */
export function batchAddUserMessage(content) {
    if (pendingBatch) {
        pendingBatch.userMessage = content;
    }
}
/**
 * Queue an assistant message in the current batch.
 */
export function batchAddAssistantMessage(content) {
    if (pendingBatch) {
        pendingBatch.assistantMessage = content;
    }
}
/**
 * Queue a thinking state change in the current batch.
 */
export function batchSetThinking(isThinking) {
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
export function flushBatchWithStore(store) {
    if (!pendingBatch)
        return false;
    const batch = pendingBatch;
    pendingBatch = null;
    const hasUser = batch.userMessage !== undefined;
    const hasAssistant = batch.assistantMessage !== undefined;
    const hasThinking = batch.isThinking !== undefined;
    if (!hasUser && !hasAssistant && !hasThinking)
        return false;
    const current = store.getState().session;
    const newMessages = [...current.messages];
    const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    if (hasUser && batch.userMessage) {
        newMessages.push({
            id: `user-${generateId()}`,
            role: 'user',
            content: batch.userMessage,
            timestamp: Date.now(),
        });
    }
    if (hasAssistant && batch.assistantMessage) {
        newMessages.push({
            id: `assistant-${generateId()}`,
            role: 'assistant',
            content: batch.assistantMessage,
            timestamp: Date.now(),
        });
    }
    const update = { messages: newMessages };
    if (hasThinking) {
        update.isThinking = batch.isThinking;
    }
    store.setState((s) => ({
        session: { ...s.session, ...update },
    }));
    return true;
}
/**
 * Cancel the current batch (e.g., on error before flush).
 */
export function cancelBatch() {
    pendingBatch = null;
}
//# sourceMappingURL=streaming-buffer.js.map