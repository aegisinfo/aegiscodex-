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
const streamingState = {
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
 * Initialize buffer for a new streaming message.
 */
export function initStreamingBuffer(messageId) {
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
export function appendToBuffer(contentDelta) {
    streamingState.content += contentDelta;
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
 * Clear the buffer (e.g., on error/abort).
 */
export function clearBuffer() {
    streamingState.messageId = null;
    streamingState.content = '';
    streamingState.thinking = '';
    streamingState.currentBlockType = null;
    streamingState.currentBlockAccumulator = '';
    streamingState.toolCalls.clear();
}
// Global consumer position — tracks how much of the buffer the RAF loop has consumed.
// This prevents the RAF loop from re-inserting old content that was flushed to the store.
let consumerPosition = { content: 0, thinking: 0 };
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
 * Drain the accumulated content block from the buffer.
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
 * Get the consumer position (used by RAF loop to track consumed content).
 */
export function getConsumerPosition() {
    return { ...consumerPosition };
}
/**
 * Reset the consumer position to the current buffer length.
 * Called after flushStreamBuffer to prevent the RAF loop from
 * re-inserting content that was just flushed to the store.
 */
export function resetConsumerPosition() {
    consumerPosition = {
        content: streamingState.content.length,
        thinking: streamingState.thinking.length,
    };
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