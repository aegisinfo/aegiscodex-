/**
 * Streaming types — replicated from Claude Code's content block streaming model.
 *
 * The Anthropic Messages API streams content as content_block_start/delta/stop
 * events, where each block (text, thinking, tool_use) has an index and a clear
 * lifecycle. This mirrors the event architecture in free-claude-code's
 * messaging/event_parser.py and messaging/transcript.py.
 */
// ==================== Event Pipeline Types ====================
/** Event types that update the transcript */
export const TRANSCRIPT_EVENT_TYPES = new Set([
    'thinking_start',
    'thinking_delta',
    'thinking_chunk',
    'thinking_stop',
    'text_start',
    'text_delta',
    'text_chunk',
    'text_stop',
    'tool_use_start',
    'tool_use_delta',
    'tool_use_stop',
    'tool_use',
    'tool_result',
    'block_stop',
    'error',
]);
//# sourceMappingURL=types.js.map