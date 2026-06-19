/**
 * OpenAIEventAdapter — converts OpenAI streaming delta chunks to AnthropicStreamEvent[].
 *
 * OpenAI streaming delivers flat delta objects (delta.content, delta.tool_calls[]).
 * The rest of the streaming pipeline speaks Anthropic's content_block model
 * (content_block_start / content_block_delta / content_block_stop).
 *
 * This stateful adapter bridges the two formats so StreamEventParser +
 * TranscriptBuffer can work regardless of which backend is in use.
 */
export class OpenAIEventAdapter {
    _textBlockOpen = false;
    _thinkingBlockOpen = false;
    _textIdx = 0;
    _thinkingIdx = 1;
    _nextToolIdx = 2;
    /** OpenAI tool call index → { id, name, blockIdx } */
    _toolBlocks = new Map();
    /**
     * Convert one OpenAI streaming chunk delta into zero or more AnthropicStreamEvents.
     * Call once per chunk, in arrival order.
     */
    adapt(delta) {
        const events = [];
        // Text content
        if (delta.content) {
            if (!this._textBlockOpen) {
                events.push({
                    type: 'content_block_start',
                    index: this._textIdx,
                    content_block: { type: 'text', text: '' },
                });
                this._textBlockOpen = true;
            }
            events.push({
                type: 'content_block_delta',
                index: this._textIdx,
                delta: { type: 'text_delta', text: delta.content },
            });
        }
        // Thinking / reasoning content (multiple field names across providers)
        const thinking = delta.reasoning_content ?? delta.thinking ?? delta.reasoning;
        if (thinking) {
            if (!this._thinkingBlockOpen) {
                events.push({
                    type: 'content_block_start',
                    index: this._thinkingIdx,
                    content_block: { type: 'thinking', thinking: '' },
                });
                this._thinkingBlockOpen = true;
            }
            events.push({
                type: 'content_block_delta',
                index: this._thinkingIdx,
                delta: { type: 'thinking_delta', thinking },
            });
        }
        // Tool calls
        if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
                const oi = tc.index;
                if (!this._toolBlocks.has(oi) && tc.id && tc.function?.name) {
                    const blockIdx = this._nextToolIdx++;
                    this._toolBlocks.set(oi, { id: tc.id, name: tc.function.name, blockIdx });
                    events.push({
                        type: 'content_block_start',
                        index: blockIdx,
                        content_block: { type: 'tool_use', id: tc.id, name: tc.function.name, input: {} },
                    });
                }
                const tool = this._toolBlocks.get(oi);
                if (tool && tc.function?.arguments) {
                    events.push({
                        type: 'content_block_delta',
                        index: tool.blockIdx,
                        delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
                    });
                }
            }
        }
        return events;
    }
    /**
     * Emit stop events for all open blocks, then message_stop.
     * Call once after the stream ends.
     */
    finalize(stopReason) {
        const events = [];
        if (this._textBlockOpen) {
            events.push({ type: 'content_block_stop', index: this._textIdx });
        }
        if (this._thinkingBlockOpen) {
            events.push({ type: 'content_block_stop', index: this._thinkingIdx });
        }
        for (const { blockIdx } of this._toolBlocks.values()) {
            events.push({ type: 'content_block_stop', index: blockIdx });
        }
        if (stopReason) {
            events.push({
                type: 'message_delta',
                delta: { stop_reason: stopReason, stop_sequence: null },
            });
        }
        events.push({ type: 'message_stop' });
        return events;
    }
}
//# sourceMappingURL=OpenAIEventAdapter.js.map