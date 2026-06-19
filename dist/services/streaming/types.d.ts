/**
 * Streaming types — replicated from Claude Code's content block streaming model.
 *
 * The Anthropic Messages API streams content as content_block_start/delta/stop
 * events, where each block (text, thinking, tool_use) has an index and a clear
 * lifecycle. This mirrors the event architecture in free-claude-code's
 * messaging/event_parser.py and messaging/transcript.py.
 */
export interface ContentBlockStartEvent {
    type: 'content_block_start';
    index: number;
    content_block: {
        type: 'text';
        text: string;
    } | {
        type: 'thinking';
        thinking: string;
    } | {
        type: 'tool_use';
        id: string;
        name: string;
        input: unknown;
    };
}
export interface ContentBlockDeltaEvent {
    type: 'content_block_delta';
    index: number;
    delta: {
        type: 'text_delta';
        text: string;
    } | {
        type: 'thinking_delta';
        thinking: string;
    } | {
        type: 'input_json_delta';
        partial_json: string;
    } | {
        type: 'citations_delta';
        citation: {
            type: string;
            cited_text: string;
            document_index: number;
            document_title?: string | null;
        };
    };
}
export interface ContentBlockStopEvent {
    type: 'content_block_stop';
    index: number;
}
export interface MessageStartEvent {
    type: 'message_start';
    message: {
        id: string;
        content: unknown[];
        usage?: {
            input_tokens: number;
            output_tokens: number;
        };
    };
}
export interface MessageDeltaEvent {
    type: 'message_delta';
    delta: {
        stop_reason: string;
        stop_sequence: string | null;
    };
    usage?: {
        output_tokens: number;
    };
}
export interface MessageStopEvent {
    type: 'message_stop';
}
export interface PingEvent {
    type: 'ping';
}
export interface ErrorEvent {
    type: 'error';
    error: {
        type: string;
        message: string;
    };
}
export type AnthropicStreamEvent = ContentBlockStartEvent | ContentBlockDeltaEvent | ContentBlockStopEvent | MessageStartEvent | MessageDeltaEvent | MessageStopEvent | PingEvent | ErrorEvent;
export type ParsedEventType = 'thinking_start' | 'thinking_delta' | 'thinking_stop' | 'thinking_chunk' | 'text_start' | 'text_delta' | 'text_stop' | 'text_chunk' | 'tool_use_start' | 'tool_use_delta' | 'tool_use_stop' | 'tool_use' | 'tool_result' | 'block_stop' | 'error' | 'complete';
export interface ParsedEvent {
    type: ParsedEventType;
    index?: number;
    text?: string;
    id?: string;
    name?: string;
    input?: unknown;
    partial_json?: string;
    tool_use_id?: string;
    content?: unknown;
    is_error?: boolean;
    message?: string;
    status?: string;
}
export type SegmentKind = 'thinking' | 'text' | 'tool_call' | 'tool_result' | 'subagent' | 'error';
export interface StreamSegment {
    kind: SegmentKind;
    /** Unique tool use id (for tool_call / tool_result) */
    id?: string;
    /** Tool name (for tool_call) */
    name?: string;
    /** Accumulated text content */
    text: string;
    /** Whether tool call is closed (received stop) */
    closed?: boolean;
    /** Subagent nesting level */
    indentLevel?: number;
    /** Whether tool result is an error */
    isError?: boolean;
    /** Subagent description (for subagent segments) */
    description?: string;
    /** Tool calls made by subagent */
    toolCalls?: number;
    /** Tools used by subagent */
    toolsUsed?: Set<string>;
}
/** Formatting functions used by segment renderers */
export interface RenderFormatting {
    /** Bold formatting */
    bold: (text: string) => string;
    /** Inline code formatting */
    codeInline: (text: string) => string;
    /** Escape text for the target format */
    escapeText: (text: string) => string;
    /** Escape text inside code spans/blocks */
    escapeCode: (text: string) => string;
    /** Render markdown string into target platform format */
    renderMarkdown: (text: string) => string;
}
export interface RenderContext {
    /** Formatting function bundle */
    formatting: RenderFormatting;
    /** Max chars for thinking tail */
    thinkingTailMax?: number;
    /** Max chars for text tail */
    textTailMax?: number;
    /** Max chars for tool output */
    toolOutputTailMax?: number;
    /** Total limit chars for rendered output */
    limitChars: number;
}
export interface RenderingProfile {
    /** Format status: emoji + label + optional suffix */
    formatStatus: (emoji: string, label: string, suffix?: string) => string;
    /** Platform parse mode (e.g. "MarkdownV2", null for plain/terminal) */
    parseMode: string | null;
    /** Render context with formatting functions */
    renderCtx: RenderContext;
    /** Max characters for a single message */
    limitChars: number;
}
/** Event types that update the transcript */
export declare const TRANSCRIPT_EVENT_TYPES: Set<ParsedEventType>;
//# sourceMappingURL=types.d.ts.map