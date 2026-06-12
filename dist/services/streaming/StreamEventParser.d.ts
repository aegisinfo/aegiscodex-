/**
 * StreamEventParser — replicates Claude Code's event_parser.py
 *
 * Parses raw Anthropic Messages API streaming events (content_block_start/delta/stop)
 * into typed internal events that the TranscriptBuffer consumes.
 *
 * This is the entry point for all streaming content. Every chunk from the API
 * stream passes through here before being applied to the transcript.
 */
import type { AnthropicStreamEvent, ParsedEvent } from './types.js';
/**
 * Parse a raw Anthropic stream event into one or more internal events.
 *
 * Returns an array of ParsedEvents (most events produce 1, content_block_start
 * may produce 2 if there's initial text). Empty array if not recognized.
 */
export declare function parseStreamEvent(event: AnthropicStreamEvent): ParsedEvent[];
//# sourceMappingURL=StreamEventParser.d.ts.map