/**
 * TranscriptBuffer — replicates Claude Code's transcript.py
 *
 * Maintains an ordered list of segments (thinking, text, tool calls, tool results,
 * subagents, errors) that represent what the user should see in the transcript.
 *
 * Key features:
 * - Content block lifecycle: start/delta/stop tracked by index
 * - Subagent nesting via Task tool stack
 * - Ordered render with tail-truncation when over limit
 * - Thread-safe segment accumulation
 */
import type { ParsedEvent, StreamSegment, RenderContext } from './types.js';
/**
 * TranscriptBuffer — ordered, truncatable transcript of streaming events.
 */
export declare class TranscriptBuffer {
    private _segments;
    /** content_block index → open thinking segment */
    private _openThinkingByIndex;
    /** content_block index → open text segment */
    private _openTextByIndex;
    /** content_block index → open tool call segment */
    private _openToolsByIndex;
    /** tool_use_id → tool name (for labeling tool results) */
    private _toolNameById;
    /** Subagent stack — each entry is the Task tool_use_id */
    private _subagentStack;
    /** Parallel subagent segment stack */
    private _subagentSegments;
    private _showToolResults;
    constructor(options?: {
        showToolResults?: boolean;
    });
    /** Current segments (read-only snapshot) */
    get segments(): readonly StreamSegment[];
    /** Whether we're inside a subagent context */
    private get _inSubagent();
    private get _currentSubagent();
    /**
     * Apply a parsed event to the transcript.
     * This is the core method — replicates transcript.py's apply().
     */
    apply(event: ParsedEvent): void;
    /**
     * Reset the buffer to initial state.
     */
    clear(): void;
    /**
     * Render transcript with optional truncation (drops oldest segments)
     * and optional status line appended at the bottom.
     *
     * Replicates transcript.py's render() method with status + tail truncation.
     */
    render(ctx: RenderContext, status?: string): string;
    private _ensureSegment;
    private _handleThinkingStart;
    private _handleThinkingDelta;
    private _handleThinkingStop;
    private _handleTextStart;
    private _handleTextDelta;
    private _handleTextStop;
    private _handleToolUseStart;
    private _handleToolUseStop;
    private _handleToolUse;
    private _handleToolResult;
    private _handleBlockStop;
    private _taskHeadingFromInput;
    private _subagentPop;
    private _renderSegment;
    private _renderThinking;
    private _renderText;
    private _renderToolCall;
    private _renderToolResult;
    private _renderSubagent;
}
//# sourceMappingURL=TranscriptBuffer.d.ts.map