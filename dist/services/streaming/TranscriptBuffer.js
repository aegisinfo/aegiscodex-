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
/**
 * TranscriptBuffer — ordered, truncatable transcript of streaming events.
 */
export class TranscriptBuffer {
    _segments = [];
    /** content_block index → open thinking segment */
    _openThinkingByIndex = new Map();
    /** content_block index → open text segment */
    _openTextByIndex = new Map();
    /** content_block index → open tool call segment */
    _openToolsByIndex = new Map();
    /** tool_use_id → tool name (for labeling tool results) */
    _toolNameById = new Map();
    /** Subagent stack — each entry is the Task tool_use_id */
    _subagentStack = [];
    /** Parallel subagent segment stack */
    _subagentSegments = [];
    _showToolResults;
    constructor(options) {
        this._showToolResults = options?.showToolResults ?? true;
    }
    /** Current segments (read-only snapshot) */
    get segments() {
        return this._segments;
    }
    /** Whether we're inside a subagent context */
    get _inSubagent() {
        return this._subagentStack.length > 0;
    }
    get _currentSubagent() {
        return this._subagentSegments.length > 0
            ? this._subagentSegments[this._subagentSegments.length - 1]
            : undefined;
    }
    /**
     * Apply a parsed event to the transcript.
     * This is the core method — replicates transcript.py's apply().
     */
    apply(event) {
        // Inside a subagent, suppress thinking/text content (only show tool calls)
        if (this._inSubagent && isThinkingOrTextEvent(event)) {
            return;
        }
        switch (event.type) {
            case 'thinking_start':
                this._handleThinkingStart(event);
                break;
            case 'thinking_delta':
            case 'thinking_chunk':
                this._handleThinkingDelta(event);
                break;
            case 'thinking_stop':
                this._handleThinkingStop(event);
                break;
            case 'text_start':
                this._handleTextStart(event);
                break;
            case 'text_delta':
            case 'text_chunk':
                this._handleTextDelta(event);
                break;
            case 'text_stop':
                this._handleTextStop(event);
                break;
            case 'tool_use_start':
                this._handleToolUseStart(event);
                break;
            case 'tool_use_delta':
                // Track open tool for close events — no visible output
                break;
            case 'tool_use_stop':
                this._handleToolUseStop(event);
                break;
            case 'tool_use':
                this._handleToolUse(event);
                break;
            case 'tool_result':
                this._handleToolResult(event);
                break;
            case 'block_stop':
                this._handleBlockStop(event);
                break;
            case 'error':
                this._segments.push({
                    kind: 'error',
                    text: event.message || 'Unknown error',
                });
                break;
            case 'complete':
                // No-op for transcript — signals end of stream
                break;
        }
    }
    /**
     * Reset the buffer to initial state.
     */
    clear() {
        this._segments = [];
        this._openThinkingByIndex.clear();
        this._openTextByIndex.clear();
        this._openToolsByIndex.clear();
        this._toolNameById.clear();
        this._subagentStack = [];
        this._subagentSegments = [];
    }
    /**
     * Render transcript with optional truncation (drops oldest segments)
     * and optional status line appended at the bottom.
     *
     * Replicates transcript.py's render() method with status + tail truncation.
     */
    render(ctx, status) {
        const parts = [];
        for (const seg of this._segments) {
            const rendered = this._renderSegment(seg, ctx);
            if (rendered) {
                parts.push(rendered);
            }
        }
        const statusText = status ? `\n\n${status}` : '';
        const prefixMarker = ctx.formatting.escapeText('... (truncated)\n');
        const joinParts = (segments, addMarker) => {
            const body = segments.join('\n');
            const text = addMarker && body ? prefixMarker + body : body;
            return text || statusText ? text + statusText : '';
        };
        // Fast path
        const candidate = joinParts(parts, false);
        if (candidate.length <= ctx.limitChars) {
            return candidate;
        }
        // Drop oldest segments until under limit (keep the tail)
        const dropped = [];
        let remaining = [...parts];
        while (remaining.length > 0) {
            const candidate_ = joinParts(remaining, true);
            if (candidate_.length <= ctx.limitChars) {
                return candidate_;
            }
            dropped.push(remaining.shift());
        }
        // Nothing fits — preserve tail of last segment instead of only marker+status
        if (dropped.length > 0) {
            const lastPart = dropped[dropped.length - 1];
            const budget = ctx.limitChars - prefixMarker.length - statusText.length;
            if (budget > 20 && lastPart) {
                const tail = lastPart.length > budget
                    ? '...' + lastPart.slice(-(budget - 3))
                    : lastPart;
                return prefixMarker + tail + statusText;
            }
        }
        // Fallback: marker + status only
        if (dropped.length > 0) {
            const minimal = prefixMarker + statusText.replace(/^\n+/, '');
            if (minimal.length <= ctx.limitChars) {
                return minimal;
            }
        }
        return status || '';
    }
    // ==================== Private Event Handlers ====================
    _ensureSegment(index, map, seg) {
        const existing = map.get(index);
        if (existing)
            return existing;
        map.set(index, seg);
        this._segments.push(seg);
        return seg;
    }
    _handleThinkingStart(event) {
        const idx = event.index ?? -1;
        if (idx >= 0) {
            // Close any previous open block at this index
            this._handleBlockStop({ type: 'block_stop', index: idx });
        }
        const seg = { kind: 'thinking', text: '' };
        this._segments.push(seg);
        if (idx >= 0) {
            this._openThinkingByIndex.set(idx, seg);
        }
    }
    _handleThinkingDelta(event) {
        const idx = event.index ?? -1;
        let seg = this._openThinkingByIndex.get(idx);
        if (!seg) {
            seg = { kind: 'thinking', text: '' };
            this._segments.push(seg);
            if (idx >= 0) {
                this._openThinkingByIndex.set(idx, seg);
            }
        }
        seg.text += event.text || '';
    }
    _handleThinkingStop(event) {
        const idx = event.index ?? -1;
        if (idx >= 0) {
            this._openThinkingByIndex.delete(idx);
        }
    }
    _handleTextStart(event) {
        const idx = event.index ?? -1;
        if (idx >= 0) {
            this._handleBlockStop({ type: 'block_stop', index: idx });
        }
        const seg = { kind: 'text', text: '' };
        this._segments.push(seg);
        if (idx >= 0) {
            this._openTextByIndex.set(idx, seg);
        }
    }
    _handleTextDelta(event) {
        const idx = event.index ?? -1;
        let seg = this._openTextByIndex.get(idx);
        if (!seg) {
            seg = { kind: 'text', text: '' };
            this._segments.push(seg);
            if (idx >= 0) {
                this._openTextByIndex.set(idx, seg);
            }
        }
        seg.text += event.text || '';
    }
    _handleTextStop(event) {
        const idx = event.index ?? -1;
        if (idx >= 0) {
            this._openTextByIndex.delete(idx);
        }
    }
    _handleToolUseStart(event) {
        const idx = event.index ?? -1;
        if (idx >= 0) {
            this._handleBlockStop({ type: 'block_stop', index: idx });
        }
        const toolId = (event.id || '').trim();
        const name = event.name || 'tool';
        if (toolId) {
            this._toolNameById.set(toolId, name);
        }
        // Task tool indicates subagent
        if (name === 'Task') {
            const description = this._taskHeadingFromInput(event.input);
            const seg = {
                kind: 'subagent',
                text: '',
                description,
                toolCalls: 0,
                toolsUsed: new Set(),
            };
            this._segments.push(seg);
            this._subagentStack.push(toolId || `__task_${this._subagentStack.length + 1}`);
            this._subagentSegments.push(seg);
            return;
        }
        // Normal tool call
        const seg = {
            kind: 'tool_call',
            id: toolId,
            name,
            text: '',
            closed: false,
            indentLevel: this._inSubagent ? 1 : 0,
        };
        if (this._inSubagent) {
            const parent = this._currentSubagent;
            if (parent) {
                parent.toolCalls = (parent.toolCalls || 0) + 1;
                if (name && parent.toolsUsed) {
                    parent.toolsUsed.add(name);
                }
            }
        }
        this._segments.push(seg);
        if (idx >= 0) {
            this._openToolsByIndex.set(idx, seg);
        }
    }
    _handleToolUseStop(event) {
        const idx = event.index ?? -1;
        const seg = this._openToolsByIndex.get(idx);
        if (seg) {
            seg.closed = true;
            this._openToolsByIndex.delete(idx);
        }
    }
    _handleToolUse(event) {
        const toolId = (event.id || '').trim();
        const name = event.name || 'tool';
        if (toolId) {
            this._toolNameById.set(toolId, name);
        }
        if (name === 'Task') {
            const description = this._taskHeadingFromInput(event.input);
            const seg = {
                kind: 'subagent',
                text: '',
                description,
                toolCalls: 0,
                toolsUsed: new Set(),
            };
            this._segments.push(seg);
            this._subagentStack.push(toolId || `__task_${this._subagentStack.length + 1}`);
            this._subagentSegments.push(seg);
            return;
        }
        const seg = {
            kind: 'tool_call',
            id: toolId,
            name,
            text: '',
            closed: true,
            indentLevel: this._inSubagent ? 1 : 0,
        };
        if (this._inSubagent) {
            const parent = this._currentSubagent;
            if (parent) {
                parent.toolCalls = (parent.toolCalls || 0) + 1;
                if (name && parent.toolsUsed) {
                    parent.toolsUsed.add(name);
                }
            }
        }
        this._segments.push(seg);
    }
    _handleToolResult(event) {
        const toolId = (event.tool_use_id || '').trim();
        const name = this._toolNameById.get(toolId);
        // If this was a Task tool result, close subagent context
        if (this._subagentStack.length > 0) {
            this._subagentPop(toolId);
        }
        if (!this._showToolResults)
            return;
        const contentStr = typeof event.content === 'string'
            ? event.content
            : event.content !== undefined
                ? safeStringify(event.content)
                : '';
        this._segments.push({
            kind: 'tool_result',
            id: toolId,
            name,
            text: contentStr,
            isError: Boolean(event.is_error),
        });
    }
    _handleBlockStop(event) {
        const idx = event.index ?? -1;
        if (idx < 0)
            return;
        if (this._openToolsByIndex.has(idx)) {
            this._handleToolUseStop({ type: 'tool_use_stop', index: idx });
            return;
        }
        if (this._openThinkingByIndex.has(idx)) {
            this._handleThinkingStop({ type: 'thinking_stop', index: idx });
            return;
        }
        if (this._openTextByIndex.has(idx)) {
            this._handleTextStop({ type: 'text_stop', index: idx });
            return;
        }
    }
    // ==================== Subagent Stack Management ====================
    _taskHeadingFromInput(input) {
        if (typeof input === 'object' && input !== null) {
            const obj = input;
            const desc = String(obj.description || '').trim();
            if (desc)
                return desc;
            const subType = String(obj.subagent_type || '').trim();
            if (subType)
                return subType;
            const typ = String(obj.type || '').trim();
            if (typ)
                return typ;
        }
        return 'Subagent';
    }
    _subagentPop(toolId) {
        const id = String(toolId || '').trim();
        if (!id) {
            // No id — only close if top is synthetic
            if (this._subagentStack.length > 0 && this._subagentStack[this._subagentStack.length - 1].startsWith('__task_')) {
                this._subagentStack.pop();
                if (this._subagentSegments.length > 0)
                    this._subagentSegments.pop();
                return true;
            }
            return false;
        }
        // Common case: LIFO — top matches
        if (this._subagentStack.length > 0) {
            const top = this._subagentStack[this._subagentStack.length - 1];
            if (top === id || top.startsWith(id) || id.startsWith(top)) {
                this._subagentStack.pop();
                if (this._subagentSegments.length > 0)
                    this._subagentSegments.pop();
                return true;
            }
        }
        // Search from top
        for (let i = this._subagentStack.length - 1; i >= 0; i--) {
            const stackId = this._subagentStack[i];
            if (stackId === id || stackId.startsWith(id) || id.startsWith(stackId)) {
                this._subagentStack.splice(i);
                this._subagentSegments.splice(i);
                return true;
            }
        }
        return false;
    }
    // ==================== Rendering ====================
    _renderSegment(seg, ctx) {
        switch (seg.kind) {
            case 'thinking':
                return this._renderThinking(seg, ctx);
            case 'text':
                return this._renderText(seg, ctx);
            case 'tool_call':
                return this._renderToolCall(seg);
            case 'tool_result':
                return this._renderToolResult(seg, ctx);
            case 'subagent':
                return this._renderSubagent(seg, ctx);
            case 'error':
                return `⚠️ ${ctx.formatting.bold('Error:')} \`${seg.text}\``;
            default:
                return '';
        }
    }
    _renderThinking(seg, ctx) {
        let raw = seg.text || '';
        if (ctx.thinkingTailMax !== undefined && raw.length > ctx.thinkingTailMax) {
            raw = '...' + raw.slice(-(ctx.thinkingTailMax - 3));
        }
        const inner = ctx.formatting.escapeCode(raw);
        return `💭 ${ctx.formatting.bold('Thinking')}\n\`\`\`\n${inner}\n\`\`\``;
    }
    _renderText(seg, ctx) {
        let raw = seg.text || '';
        if (ctx.textTailMax !== undefined && raw.length > ctx.textTailMax) {
            raw = '...' + raw.slice(-(ctx.textTailMax - 3));
        }
        return ctx.formatting.renderMarkdown(raw);
    }
    _renderToolCall(seg) {
        const prefix = '  '.repeat(seg.indentLevel || 0);
        const name = `\`${seg.name}\``;
        return `${prefix}🛠 **Tool call:** ${name}`;
    }
    _renderToolResult(seg, ctx) {
        let raw = seg.text || '';
        if (ctx.toolOutputTailMax !== undefined && raw.length > ctx.toolOutputTailMax) {
            raw = '...' + raw.slice(-(ctx.toolOutputTailMax - 3));
        }
        const inner = ctx.formatting.escapeCode(raw);
        const label = seg.isError ? 'Tool error:' : 'Tool result:';
        const namePart = seg.name ? ` \`${seg.name}\`` : '';
        return `📤 **${label}**${namePart}\n\`\`\`\n${inner}\n\`\`\``;
    }
    _renderSubagent(seg, ctx) {
        const desc = seg.description || 'Subagent';
        const toolsUsed = seg.toolsUsed ? [...seg.toolsUsed].sort() : [];
        const toolCalls = seg.toolCalls ?? 0;
        const parts = [
            `🤖 **Subagent:** \`${desc}\``,
        ];
        if (toolsUsed.length > 0) {
            const toolsSet = `{${toolsUsed.join(', ')}}`;
            parts.push(`  **Tools used:** \`${toolsSet}\``);
        }
        parts.push(`  **Tool calls:** \`${toolCalls}\``);
        return parts.join('\n');
    }
}
// ==================== Helpers ====================
function isThinkingOrTextEvent(event) {
    return [
        'thinking_start',
        'thinking_delta',
        'thinking_chunk',
        'text_start',
        'text_delta',
        'text_chunk',
    ].includes(event.type);
}
function safeStringify(obj) {
    try {
        return JSON.stringify(obj, null, 2);
    }
    catch {
        return String(obj);
    }
}
//# sourceMappingURL=TranscriptBuffer.js.map