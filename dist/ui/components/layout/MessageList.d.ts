/**
 * MessageList - renders messages with RAF-throttled streaming content.
 *
 * Completed messages go into Ink's <Static> (terminal scrollback, rendered once).
 * The active streaming message stays in the dynamic area so it updates live.
 * Input area is always visible at the bottom of the terminal.
 *
 * Why bypass the store for streaming content?
 *   vanillaStore.setState() triggers the subscription on every delta, forcing
 *   full Ink reconciliation and a visible terminal "blink" at every tick.
 *   The RAF loop polls the mutable buffer directly and only bumps a LOCAL
 *   counter (streamingVersion) — only MessageList re-renders, nothing else.
 */
import React from 'react';
interface MessageListProps {
    terminalWidth: number;
}
export declare const MessageList: React.FC<MessageListProps>;
export default MessageList;
//# sourceMappingURL=MessageList.d.ts.map