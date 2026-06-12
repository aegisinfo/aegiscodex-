/**
 * Event type → status mapping for streaming UI updates.
 *
 * Replicates free-claude-code's messaging/cli_event_constants.py.
 * Maps parsed event types to emoji + label pairs that get formatted
 * into status lines shown below the transcript.
 */
import type { ParsedEventType } from './types.js';
type StatusFormatter = (emoji: string, label: string, suffix?: string) => string;
/**
 * Get status string for a parsed event type.
 * Returns null if no status update is needed for this event type.
 */
export declare function getStatusForEvent(eventType: ParsedEventType, name: string | undefined, formatStatus: StatusFormatter): string | null;
/** Status message prefixes used to filter echo of our own messages */
export declare const STATUS_MESSAGE_PREFIXES: string[];
export {};
//# sourceMappingURL=eventStatusMap.d.ts.map