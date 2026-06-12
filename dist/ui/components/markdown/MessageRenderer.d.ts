/**
 * MessageRenderer - renders markdown content with memoization
 *
 * Critical perf note: no useStore hooks inside the memo component!
 * useShowAllThinking is passed as a prop from MessageList to avoid
 * re-rendering every message when the global toggle changes.
 *
 * Supports Content Block model (Claude-style):
 * - text blocks → rendered as markdown
 * - thinking blocks → collapsible with preview
 * - tool_use blocks → formatted tool calls with status
 * - tool_result blocks → tool output
 */
import React from 'react';
import type { ContentBlock } from '../../../store/types.js';
interface MessageRendererProps {
    content: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    terminalWidth?: number;
    showPrefix?: boolean;
    thinking?: string;
    isStreaming?: boolean;
    /** Passed from parent to avoid hook call inside memo */
    showAllThinking?: boolean;
    /** Content blocks for Claude-style structured rendering */
    contentBlocks?: ContentBlock[];
}
export declare const MessageRenderer: React.FC<MessageRendererProps>;
export default MessageRenderer;
//# sourceMappingURL=MessageRenderer.d.ts.map