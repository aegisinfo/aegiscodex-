/**
 * MessageList - renders messages with RAF-throttled streaming content.
 *
 * Owns scroll state internally — no split state with parent.
 * Handles PgUp/PgDn/Ctrl+W/Ctrl+S/Ctrl+Up/Down/Home/End via useInput.
 * No auto-scroll; user controls position fully via keyboard.
 *
 * Why the RAF loop?
 *   vanillaStore.setState() triggers the subscription on every delta, forcing
 *   full Ink reconciliation and a visible terminal "blink" at every tick.
 *   The RAF loop polls the mutable buffer directly and only bumps a LOCAL
 *   counter (streamingVersion) — only MessageList re-renders, nothing else.
 */
import React from 'react';
interface MessageListProps {
    terminalWidth: number;
    terminalHeight: number;
    /** Called when scroll state changes (for status bar indicator) */
    onScrolledUpChange?: (isScrolledUp: boolean) => void;
    /** Called with render latency (ms) during streaming — for status bar display */
    onRenderLatency?: (ms: number) => void;
    /** Number of queued commands shown below the message list (adjusts viewport budget) */
    pendingCommandCount?: number;
}
export declare const MessageList: React.FC<MessageListProps>;
export default MessageList;
//# sourceMappingURL=MessageList.d.ts.map