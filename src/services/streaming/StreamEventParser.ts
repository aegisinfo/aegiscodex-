/**
 * StreamEventParser — replicates Claude Code's event_parser.py
 *
 * Parses raw Anthropic Messages API streaming events (content_block_start/delta/stop)
 * into typed internal events that the TranscriptBuffer consumes.
 *
 * This is the entry point for all streaming content. Every chunk from the API
 * stream passes through here before being applied to the transcript.
 */

import type {
  AnthropicStreamEvent,
  ParsedEvent,
  ContentBlockStartEvent,
  ContentBlockDeltaEvent,
  MessageStartEvent,
} from './types.js';

/**
 * Parse a raw Anthropic stream event into one or more internal events.
 *
 * Returns an array of ParsedEvents (most events produce 1, content_block_start
 * may produce 2 if there's initial text). Empty array if not recognized.
 */
export function parseStreamEvent(event: AnthropicStreamEvent): ParsedEvent[] {
  const results: ParsedEvent[] = [];

  switch (event.type) {
    case 'content_block_start':
      return parseContentBlockStart(event);

    case 'content_block_delta':
      return parseContentBlockDelta(event);

    case 'content_block_stop':
      return [{ type: 'block_stop', index: event.index }];

    case 'message_start':
      // message_start contains initial content blocks in non-streaming form.
      // If the API sends content inline, parse them as full blocks.
      return parseMessageContent(event);

    case 'message_delta':
      // message_delta signals completion metadata — map to complete event.
      return [{ type: 'complete', status: event.delta.stop_reason }];

    case 'message_stop':
      // Signal final completion. If no content was streamed, this ensures
      // the transcript shows something.
      return [{ type: 'complete', status: 'message_stop' }];

    case 'ping':
      return [];

    case 'error':
      return [{
        type: 'error',
        message: event.error?.message || 'Unknown API error',
      }];

    default:
      return [];
  }
}

/**
 * Parse content_block_start — produces the start event for the block type,
 * plus potentially initial text/thinking content.
 */
function parseContentBlockStart(event: ContentBlockStartEvent): ParsedEvent[] {
  const block = event.content_block;
  const results: ParsedEvent[] = [];

  switch (block.type) {
    case 'thinking':
      results.push({ type: 'thinking_start', index: event.index });
      if (block.thinking) {
        results.push({ type: 'thinking_delta', index: event.index, text: block.thinking });
      }
      break;

    case 'text':
      results.push({ type: 'text_start', index: event.index });
      if (block.text) {
        results.push({ type: 'text_delta', index: event.index, text: block.text });
      }
      break;

    case 'tool_use':
      results.push({
        type: 'tool_use_start',
        index: event.index,
        id: block.id,
        name: block.name,
        input: block.input,
      });
      break;
  }

  return results;
}

/**
 * Parse content_block_delta — produces delta events for the block type.
 */
function parseContentBlockDelta(event: ContentBlockDeltaEvent): ParsedEvent[] {
  const delta = event.delta;

  switch (delta.type) {
    case 'text_delta':
      return [{
        type: 'text_delta',
        index: event.index,
        text: delta.text,
      }];

    case 'thinking_delta':
      return [{
        type: 'thinking_delta',
        index: event.index,
        text: delta.thinking,
      }];

    case 'input_json_delta':
      return [{
        type: 'tool_use_delta',
        index: event.index,
        partial_json: delta.partial_json,
      }];

    default:
      return [];
  }
}

/**
 * Parse message content from message_start event — handles non-streaming
 * content blocks that arrive inline.
 */
function parseMessageContent(event: MessageStartEvent): ParsedEvent[] {
  const content = event.message?.content;
  if (!Array.isArray(content) || content.length === 0) return [];

  const results: ParsedEvent[] = [];

  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue;

    const b = block as Record<string, unknown>;

    switch (b.type) {
      case 'text':
        results.push({ type: 'text_chunk' as const, text: String(b.text || '') });
        break;

      case 'thinking':
        results.push({ type: 'thinking_chunk' as const, text: String(b.thinking || '') });
        break;

      case 'tool_use':
        results.push({
          type: 'tool_use' as const,
          id: String(b.id || '').trim(),
          name: String(b.name || ''),
          input: b.input,
        });
        break;

      case 'tool_result':
        results.push({
          type: 'tool_result' as const,
          tool_use_id: String(b.tool_use_id || '').trim(),
          content: b.content,
          is_error: Boolean(b.is_error),
        });
        break;
    }
  }

  return results;
}
