/**
 * Event type → status mapping for streaming UI updates.
 *
 * Replicates free-claude-code's messaging/cli_event_constants.py.
 * Maps parsed event types to emoji + label pairs that get formatted
 * into status lines shown below the transcript.
 */

import type { ParsedEventType } from './types.js';

type StatusFormatter = (emoji: string, label: string, suffix?: string) => string;

/** Event type → (emoji, label) for status updates */
const EVENT_STATUS_MAP: Record<string, [string, string]> = {
  thinking_start: ['🧠', 'Claude is thinking...'],
  thinking_delta: ['🧠', 'Claude is thinking...'],
  thinking_chunk: ['🧠', 'Claude is thinking...'],
  text_start: ['🧠', 'Claude is working...'],
  text_delta: ['🧠', 'Claude is working...'],
  text_chunk: ['🧠', 'Claude is working...'],
  tool_result: ['⏳', 'Executing tools...'],
};

/**
 * Get status string for a parsed event type.
 * Returns null if no status update is needed for this event type.
 */
export function getStatusForEvent(
  eventType: ParsedEventType,
  name: string | undefined,
  formatStatus: StatusFormatter,
): string | null {
  const entry = EVENT_STATUS_MAP[eventType];
  if (entry) {
    const [emoji, label] = entry;
    return formatStatus(emoji, label);
  }

  if (eventType === 'tool_use_start' || eventType === 'tool_use_delta' || eventType === 'tool_use') {
    if (name === 'Task') {
      return formatStatus('🤖', 'Subagent working...');
    }
    return formatStatus('⏳', 'Executing tools...');
  }

  return null;
}

/** Status message prefixes used to filter echo of our own messages */
export const STATUS_MESSAGE_PREFIXES = [
  '⏳', '💭', '🔧', '✅', '❌', '🚀', '🤖', '📋', '📊', '🔄',
];
