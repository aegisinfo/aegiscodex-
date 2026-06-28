/**
 * Services 模块导出
 */

// VersionChecker
export {
  checkVersion,
  checkVersionOnStartup,
  setSkipUntilVersion,
  clearSkipVersion,
  getUpgradeCommand,
  performUpgrade,
  getCurrentVersion,
} from './VersionChecker.js';

export type { VersionCheckResult } from './VersionChecker.js';

// ChatService
export {
  OpenAIChatService,
  createChatService,
} from './ChatService.js';

export type { ChatServiceConfig } from './ChatService.js';

// Streaming
export {
  parseStreamEvent,
  TranscriptBuffer,
  ThrottledRenderer,
  TERMINAL_FORMATTING,
  PLAIN_TEXT_FORMATTING,
  buildRenderContext,
  TERMINAL_PROFILE,
  PLAIN_TEXT_PROFILE,
  COMPACT_TERMINAL_PROFILE,
  buildRenderingProfile,
  getStatusForEvent,
  STATUS_MESSAGE_PREFIXES,
} from './streaming/index.js';
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
} from './streaming/types.js';
export { TRANSCRIPT_EVENT_TYPES } from './streaming/types.js';
