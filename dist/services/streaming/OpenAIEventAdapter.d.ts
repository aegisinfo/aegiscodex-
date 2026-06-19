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
import type { AnthropicStreamEvent } from './types.js';
export declare class OpenAIEventAdapter {
    private _textBlockOpen;
    private _thinkingBlockOpen;
    private _textIdx;
    private _thinkingIdx;
    private _nextToolIdx;
    /** OpenAI tool call index → { id, name, blockIdx } */
    private _toolBlocks;
    /**
     * Convert one OpenAI streaming chunk delta into zero or more AnthropicStreamEvents.
     * Call once per chunk, in arrival order.
     */
    adapt(delta: {
        content?: string | null;
        reasoning_content?: string | null;
        thinking?: string | null;
        reasoning?: string | null;
        tool_calls?: Array<{
            index: number;
            id?: string;
            function?: {
                name?: string;
                arguments?: string;
            };
        }> | null;
    }): AnthropicStreamEvent[];
    /**
     * Emit stop events for all open blocks, then message_stop.
     * Call once after the stream ends.
     */
    finalize(stopReason?: string): AnthropicStreamEvent[];
}
//# sourceMappingURL=OpenAIEventAdapter.d.ts.map