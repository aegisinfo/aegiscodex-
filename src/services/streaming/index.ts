/**
 * Streaming module exports — Claude Code-style content block streaming + rendering.
 *
 * Provides:
 * - StreamEventParser: Parse Anthropic content_block_start/delta/stop events
 * - TranscriptBuffer: Ordered, truncatable transcript with segment management
 * - ThrottledRenderer: Rate-limited transcript rendering with status lines
 * - RenderingProfile: Platform-specific rendering configuration
 * - Render formatting functions for terminal/plain output
 * - Event → status mapping for live UI updates
 * - Type definitions for all streaming events, segments, and rendering
 */

export { parseStreamEvent } from './StreamEventParser.js';
export { TranscriptBuffer } from './TranscriptBuffer.js';
export { ThrottledRenderer } from './ThrottledRenderer.js';
export {
  TERMINAL_FORMATTING,
  PLAIN_TEXT_FORMATTING,
  buildRenderContext,
} from './renderFormatting.js';
export {
  TERMINAL_PROFILE,
  PLAIN_TEXT_PROFILE,
  COMPACT_TERMINAL_PROFILE,
  buildRenderingProfile,
} from './RenderingProfile.js';
export { getStatusForEvent, STATUS_MESSAGE_PREFIXES } from './eventStatusMap.js';
export { OpenAIEventAdapter } from './OpenAIEventAdapter.js';
export type {
  AnthropicStreamEvent,
  ContentBlockStartEvent,
  ContentBlockDeltaEvent,
  ContentBlockStopEvent,
  MessageStartEvent,
  MessageDeltaEvent,
  MessageStopEvent,
  ParsedEvent,
  ParsedEventType,
  StreamSegment,
  SegmentKind,
  RenderContext,
  RenderFormatting,
  RenderingProfile,
} from './types.js';
export { TRANSCRIPT_EVENT_TYPES } from './types.js';
