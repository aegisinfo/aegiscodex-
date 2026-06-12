import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
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
import React, { useMemo, useState, useEffect, useRef, memo } from 'react';
import { Box, Text } from 'ink';
import stringWidth from 'string-width';
import { parseMarkdown } from './parser.js';
import { themeManager } from '../../themes/index.js';
import { CodeHighlighter } from './CodeHighlighter.js';
/**
 * Custom comparator: prevent re-renders only when nothing has changed.
 * During streaming, content changes every delta — we MUST re-render to show them.
 * The old code had `!next.isStreaming` which blocked ALL streaming content updates.
 */
const messageRendererComparator = (prev, next) => {
    if (prev.role !== next.role)
        return false;
    if (prev.isStreaming !== next.isStreaming)
        return false;
    if (prev.showAllThinking !== next.showAllThinking)
        return false;
    if (prev.terminalWidth !== next.terminalWidth)
        return false;
    if (prev.showPrefix !== next.showPrefix)
        return false;
    // Always compare content — even during streaming, we need to show deltas
    if (prev.content !== next.content)
        return false;
    // Compare thinking state
    if (prev.thinking !== next.thinking)
        return false;
    // Compare content blocks
    if (prev.contentBlocks !== next.contentBlocks)
        return false;
    return true;
};
export const MessageRenderer = memo(({ content, role, terminalWidth = 80, showPrefix = true, thinking, isStreaming, showAllThinking = false, contentBlocks, }) => {
    const theme = themeManager.getTheme();
    const roleStyle = themeManager.getRoleStyle(role);
    const [localExpanded, setLocalExpanded] = useState(!!isStreaming);
    useEffect(() => {
        if (isStreaming) {
            setLocalExpanded(true);
        }
        else if (thinking) {
            setLocalExpanded(false);
        }
    }, [isStreaming, !!thinking]);
    const isThinkingExpanded = showAllThinking || localExpanded;
    // Incremental markdown parse cache — avoids re-parsing stable content
    // during streaming by detecting append-only growth and reusing blocks.
    const parseCacheRef = useRef({ content: '', blocks: [] });
    const blocks = useMemo(() => {
        const cache = parseCacheRef.current;
        if (content === cache.content)
            return cache.blocks;
        // Incremental: content only grew (append-only streaming delta)
        if (content.startsWith(cache.content) && cache.content.length > 0) {
            const delta = content.slice(cache.content.length);
            const deltaFirstLine = delta.split('\n')[0];
            // Fast path: delta is pure text (no block-starting patterns like ```, #, -, >, |)
            if (!/^```|^#{1,6}\s|^[-*+]\s|^\d+\.\s|^>\s|^\s*$|^\|/.test(deltaFirstLine)) {
                const newBlocks = cache.blocks.slice();
                const lastBlock = newBlocks[newBlocks.length - 1];
                if (lastBlock && lastBlock.type === 'text') {
                    newBlocks[newBlocks.length - 1] = { ...lastBlock, content: lastBlock.content + delta };
                    parseCacheRef.current = { content, blocks: newBlocks };
                    return newBlocks;
                }
            }
        }
        // Full re-parse for structural changes or first render
        const parsed = parseMarkdown(content);
        parseCacheRef.current = { content, blocks: parsed };
        return parsed;
    }, [content]);
    const thinkingBlocks = useMemo(() => (thinking ? parseMarkdown(thinking) : []), [thinking]);
    const filteredBlocks = useMemo(() => {
        return blocks.filter((block, index) => {
            if (block.type !== 'empty')
                return true;
            // Filter out leading empty blocks
            if (index === 0)
                return false;
            // Deduplicate consecutive empty blocks (keep one for paragraph spacing)
            if (blocks[index - 1].type === 'empty')
                return false;
            // Keep a single empty block between non-empty blocks for spacing
            return true;
        });
    }, [blocks]);
    const filteredThinkingBlocks = useMemo(() => {
        return thinkingBlocks.filter((block) => block.type !== 'empty');
    }, [thinkingBlocks]);
    const thinkingWordCount = useMemo(() => {
        if (!thinking)
            return 0;
        return thinking.trim().split(/\s+/).filter(Boolean).length;
    }, [thinking]);
    const prefixOffset = showPrefix && roleStyle ? roleStyle.prefix.length + 1 : 0;
    const hasToolBlocks = contentBlocks && contentBlocks.some(b => b.type === 'tool_use' || b.type === 'tool_result');
    return (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [filteredThinkingBlocks.length > 0 && (_jsx(Box, { flexDirection: "column", marginBottom: 1, children: isThinkingExpanded ? (_jsxs(_Fragment, { children: [_jsx(Box, { marginBottom: 0, children: _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [showPrefix && roleStyle && _jsxs(Text, { children: [roleStyle.prefix, " "] }), isStreaming ? (_jsxs(_Fragment, { children: [_jsx(Text, { color: theme.colors.primary, children: '□ ' }), _jsx(Text, { color: theme.colors.text.muted, dimColor: true, italic: true, children: "thinking" }), thinkingWordCount > 0 && _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [" \u00B7 ", thinkingWordCount, "w..."] })] })) : (_jsxs(_Fragment, { children: [_jsx(Text, { color: theme.colors.primary, children: '□ ' }), _jsx(Text, { color: theme.colors.text.muted, dimColor: true, italic: true, children: "thought" }), thinkingWordCount > 0 && (_jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [" \u00B7 ", thinkingWordCount, "w"] }))] }))] }) }), _jsx(Box, { flexDirection: "column", marginLeft: prefixOffset, borderStyle: "round", borderColor: theme.colors.border.light, paddingX: 1, children: filteredThinkingBlocks.map((block, index) => (_jsx(Box, { children: _jsx(Text, { color: theme.colors.text.muted, dimColor: true, italic: true, children: block.content }) }, index))) })] })) : (_jsxs(Box, { marginLeft: prefixOffset, children: [_jsx(Text, { color: theme.colors.primary, children: '□ ' }), _jsx(Text, { color: theme.colors.text.muted, dimColor: true, italic: true, children: "thought" }), thinkingWordCount > 0 && (_jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [" \u00B7 ", thinkingWordCount, "w"] }))] })) })), filteredBlocks.map((block, index) => (_jsx(BlockRenderer, { block: block, isFirst: index === 0 && filteredThinkingBlocks.length === 0, roleStyle: showPrefix ? roleStyle : undefined, terminalWidth: terminalWidth, theme: theme }, index))), hasToolBlocks && (_jsx(Box, { flexDirection: "column", marginTop: 1, children: contentBlocks.map((block, idx) => {
                    if (block.type === 'tool_use') {
                        return (_jsx(ToolUseBlockRenderer, { name: block.name, input: block.input, status: block.status, startedAt: block.startedAt, completedAt: block.completedAt, theme: theme, prefixOffset: prefixOffset }, `tool-${block.id || idx}`));
                    }
                    if (block.type === 'tool_result') {
                        return (_jsx(ToolResultBlockRenderer, { content: block.content, isError: block.is_error, theme: theme, prefixOffset: prefixOffset }, `result-${block.tool_use_id || idx}`));
                    }
                    return null;
                }) })), isStreaming && (_jsx(StreamingCursor, { prefixOffset: prefixOffset })), !isStreaming && (_jsx(MessageSeparator, { width: terminalWidth }))] }));
}, messageRendererComparator);
MessageRenderer.displayName = 'MessageRenderer';
// ===== Message Separator =====
const MessageSeparator = React.memo(({ width }) => {
    const theme = themeManager.getTheme();
    const lineWidth = Math.max(4, Math.min(width - 2, 78));
    return (_jsx(Box, { marginTop: 0, children: _jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: '─'.repeat(lineWidth) }) }));
});
MessageSeparator.displayName = 'MessageSeparator';
// ===== Streaming Cursor Component (animated) =====
// Clean blinking cursor — subtle thin bar, no pulsing blue block
const CURSOR_FRAMES = ['▏', ' '];
const CURSOR_INTERVAL = 530; // ms — calm blink rate
const StreamingCursor = React.memo(({ prefixOffset }) => {
    const theme = themeManager.getTheme();
    const [visible, setVisible] = useState(true);
    useEffect(() => {
        const interval = setInterval(() => {
            setVisible(v => !v);
        }, CURSOR_INTERVAL);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (_jsx(Box, { marginLeft: prefixOffset, children: _jsx(Text, { color: "#4488ff", children: visible ? CURSOR_FRAMES[0] : CURSOR_FRAMES[1] }) }));
});
StreamingCursor.displayName = 'StreamingCursor';
// ===== Tool Call Visual Components =====
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPINNER_INTERVAL = 80;
const ToolSpinner = React.memo(({ color }) => {
    const [frame, setFrame] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setFrame(f => (f + 1) % SPINNER_FRAMES.length), SPINNER_INTERVAL);
        return () => clearInterval(timer);
    }, []);
    return _jsx(Text, { color: color, children: SPINNER_FRAMES[frame] });
});
ToolSpinner.displayName = 'ToolSpinner';
function shortenPath(p) {
    if (p.length <= 45)
        return p;
    const parts = p.split('/');
    return parts.length > 3 ? '…/' + parts.slice(-2).join('/') : p;
}
function getToolSummary(name, input) {
    if (!input)
        return name;
    try {
        const args = JSON.parse(input);
        switch (name) {
            case 'Read':
            case 'Write':
            case 'Edit':
                return `${name}(${shortenPath(args.file_path || '')})`;
            case 'Bash': {
                const cmd = (args.command || '').trim().replace(/\n/g, ' ');
                return `${name}(${cmd.length > 60 ? cmd.slice(0, 57) + '…' : cmd})`;
            }
            case 'Glob':
                return `${name}(${args.pattern || ''})`;
            case 'Grep':
                return `${name}(${args.pattern || ''}${args.path ? ` in ${shortenPath(args.path)}` : ''})`;
            default: {
                const entries = Object.entries(args);
                if (entries.length === 0)
                    return name;
                const [, val] = entries[0];
                const valStr = String(val);
                return `${name}(${valStr.length > 45 ? valStr.slice(0, 42) + '…' : valStr})`;
            }
        }
    }
    catch {
        return name;
    }
}
// Split "Name(path)" into {label, path} for separate coloring
function splitToolSummary(summary) {
    const m = summary.match(/^([^(]+)(\(.+\))$/);
    if (m)
        return { label: m[1], path: m[2] };
    return { label: summary, path: '' };
}
function formatElapsed(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}
const ToolUseBlockRenderer = ({ name, input, status, startedAt, completedAt, theme, prefixOffset, }) => {
    const summary = useMemo(() => getToolSummary(name, input), [name, input]);
    const { label, path } = useMemo(() => splitToolSummary(summary), [summary]);
    const isRunning = status === 'running';
    const isError = status === 'error';
    const elapsed = !isRunning && completedAt ? formatElapsed(completedAt - startedAt) : null;
    return (_jsx(Box, { marginLeft: prefixOffset + 2, marginY: 0, children: isRunning ? (_jsxs(_Fragment, { children: [_jsx(ToolSpinner, { color: theme.colors.primary }), _jsxs(Text, { color: theme.colors.text.secondary, children: [' ', label] }), path && _jsx(Text, { color: theme.colors.primary, children: path })] })) : isError ? (_jsxs(_Fragment, { children: [_jsx(Text, { color: theme.colors.error, children: '• ' }), _jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: label }), path && _jsx(Text, { color: theme.colors.primary, dimColor: true, children: path }), elapsed && _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [' ', elapsed] })] })) : (_jsxs(_Fragment, { children: [_jsx(Text, { color: theme.colors.success, children: '• ' }), _jsx(Text, { color: theme.colors.text.secondary, children: label }), path && _jsx(Text, { color: theme.colors.primary, children: path }), elapsed && _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [' ', elapsed] })] })) }));
};
const ToolResultBlockRenderer = ({ content, isError, theme, prefixOffset, }) => {
    const lines = useMemo(() => {
        if (!content)
            return [];
        const all = content.split('\n').filter(l => l.trim());
        return all.slice(0, 4);
    }, [content]);
    if (lines.length === 0)
        return null;
    return (_jsx(Box, { flexDirection: "column", marginLeft: prefixOffset + 2, marginBottom: 0, children: lines.map((line, i) => (_jsxs(Box, { children: [_jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: i === 0 ? '⎿  ' : '   ' }), _jsx(Text, { color: isError ? theme.colors.error : theme.colors.text.muted, dimColor: true, wrap: "wrap", children: line.length > 120 ? line.slice(0, 117) + '…' : line })] }, i))) }));
};
const BlockRenderer = ({ block, isFirst, roleStyle, terminalWidth, theme, }) => {
    const prefixWidth = roleStyle?.prefix.length ?? 0;
    const contentWidth = terminalWidth - prefixWidth - 2;
    if (block.type === 'empty') {
        return null;
    }
    return (_jsxs(Box, { flexDirection: "row", children: [isFirst && roleStyle && (_jsx(Box, { marginRight: 1, children: _jsx(Text, { color: roleStyle.color, bold: roleStyle.bold, children: roleStyle.prefix }) })), !isFirst && roleStyle && _jsx(Box, { width: prefixWidth + 1 }), _jsx(Box, { flexGrow: 1, flexShrink: 1, children: block.type === 'code' ? (_jsx(CodeBlock, { content: block.content, language: block.language, filePath: block.filePath, theme: theme })) : block.type === 'heading' ? (_jsx(Heading, { content: block.content, level: block.level || 1, theme: theme })) : block.type === 'list' ? (_jsx(ListItem, { content: block.content, listType: block.listType, marker: block.marker, indent: block.indent, theme: theme })) : block.type === 'hr' ? (_jsx(HorizontalRule, { width: contentWidth, theme: theme })) : block.type === 'table' && block.tableData ? (_jsx(TableRenderer, { headers: block.tableData.headers, rows: block.tableData.rows, alignments: block.tableData.alignments, theme: theme })) : block.type === 'blockquote' ? (_jsx(Blockquote, { content: block.content, theme: theme })) : (_jsx(TextBlock, { content: block.content, theme: theme })) })] }));
};
const CodeBlock = ({ content, language, filePath }) => {
    return (_jsx(CodeHighlighter, { content: content, language: language, filePath: filePath, showLineNumbers: true }));
};
const Heading = ({ content, level, theme, }) => {
    const color = level === 1
        ? theme.colors.primary
        : level === 2
            ? theme.colors.secondary
            : level === 3
                ? theme.colors.accent
                : theme.colors.text.primary;
    const marginY = level <= 2 ? 1 : 0;
    const underline = level === 1;
    const hasInlineFormat = /\*\*|`|~~|\[.*\]\(/.test(content);
    return (_jsx(Box, { flexDirection: "column", marginY: marginY, children: hasInlineFormat ? (_jsx(Text, { color: color, bold: true, underline: underline, children: _jsx(HeadingInlineText, { content: content, theme: theme, baseColor: color }) })) : (_jsx(Text, { color: color, bold: true, underline: underline, children: content })) }));
};
const ListItem = ({ content, listType, marker, indent = 0, theme }) => {
    const indentStr = '  '.repeat(Math.floor(indent / 2));
    const bulletColor = listType === 'ol' ? theme.colors.info : theme.colors.success;
    return (_jsxs(Box, { children: [_jsxs(Text, { children: [indentStr, _jsx(Text, { color: bulletColor, children: marker || '•' }), ' '] }), _jsx(Text, { wrap: "wrap", children: _jsx(InlineText, { content: content, theme: theme }) })] }));
};
const HorizontalRule = ({ width, theme, }) => (_jsx(Box, { marginY: 1, children: _jsx(Text, { color: theme.colors.border.light, children: '─'.repeat(Math.max(width, 10)) }) }));
const stripMarkdownForWidth = (text) => {
    return text
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/~~(.+?)~~/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
};
const TableRenderer = ({ headers, rows, alignments, theme }) => {
    const columnWidths = headers.map((header, index) => {
        const headerWidth = stringWidth(stripMarkdownForWidth(header));
        const maxRowWidth = Math.max(0, ...rows.map((row) => stringWidth(stripMarkdownForWidth(row[index] || ''))));
        return Math.max(headerWidth, maxRowWidth) + 2;
    });
    const renderCell = (content, width, align) => {
        const actualWidth = stringWidth(stripMarkdownForWidth(content));
        const padding = Math.max(0, width - actualWidth);
        if (align === 'center') {
            const left = Math.floor(padding / 2);
            const right = padding - left;
            return ' '.repeat(left) + content + ' '.repeat(right);
        }
        if (align === 'right') {
            return ' '.repeat(padding) + content;
        }
        return content + ' '.repeat(padding);
    };
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsxs(Box, { children: [_jsx(Text, { color: theme.colors.border.light, children: "\u2502" }), headers.map((header, index) => (_jsxs(React.Fragment, { children: [_jsx(Text, { bold: true, color: theme.colors.primary, children: renderCell(header, columnWidths[index], alignments[index] || 'left') }), _jsx(Text, { color: theme.colors.border.light, children: "\u2502" })] }, index)))] }), _jsxs(Box, { children: [_jsx(Text, { color: theme.colors.border.light, children: "\u251C" }), columnWidths.map((width, index) => (_jsxs(React.Fragment, { children: [_jsx(Text, { color: theme.colors.border.light, children: '─'.repeat(width) }), _jsx(Text, { color: theme.colors.border.light, children: index < columnWidths.length - 1 ? '┼' : '┤' })] }, index)))] }), rows.map((row, rowIndex) => (_jsxs(Box, { children: [_jsx(Text, { color: theme.colors.border.light, children: "\u2502" }), headers.map((_, colIndex) => {
                        const cellContent = row[colIndex] || '';
                        const paddedContent = renderCell(cellContent, columnWidths[colIndex], alignments[colIndex] || 'left');
                        const hasInlineFormat = /\*\*|`|~~|\[.*\]\(/.test(cellContent);
                        return (_jsxs(React.Fragment, { children: [hasInlineFormat ? (_jsx(Text, { children: _jsx(InlineText, { content: paddedContent, theme: theme }) })) : (_jsx(Text, { children: paddedContent })), _jsx(Text, { color: theme.colors.border.light, children: "\u2502" })] }, colIndex));
                    })] }, rowIndex)))] }));
};
const Blockquote = ({ content, theme, }) => (_jsxs(Box, { children: [_jsx(Text, { color: theme.colors.border.light, children: "\u2502 " }), _jsx(Text, { color: theme.colors.text.muted, italic: true, wrap: "wrap", children: content })] }));
const TOOLCALL_RE = /^\s{2,}(\S+)\s*(.*?)\s*(✓|✗.*)$/;
const ToolCallLine = ({ content, theme, }) => {
    const m = content.match(TOOLCALL_RE);
    if (!m)
        return _jsx(Text, { dimColor: true, children: content });
    const [, name, args, result] = m;
    const isErr = result.startsWith('✗');
    return (_jsxs(Box, { children: [_jsx(Text, { dimColor: true, color: theme.colors.text.muted, children: '  ' }), _jsx(Text, { dimColor: true, color: theme.colors.text.secondary, children: name }), args ? _jsxs(Text, { dimColor: true, color: theme.colors.text.muted, children: [' ', args] }) : null, _jsxs(Text, { dimColor: true, color: isErr ? theme.colors.error : theme.colors.success, children: [' ', result] })] }));
};
const TextBlock = ({ content, theme, }) => {
    if (TOOLCALL_RE.test(content)) {
        return _jsx(ToolCallLine, { content: content, theme: theme });
    }
    return (_jsx(Text, { wrap: "wrap", children: _jsx(InlineText, { content: content, theme: theme }) }));
};
const HeadingInlineText = ({ content, theme, baseColor }) => {
    const segments = parseInline(content);
    return (_jsx(_Fragment, { children: segments.map((seg, i) => {
            switch (seg.type) {
                case 'bold':
                    return (_jsx(Text, { bold: true, color: theme.colors.text.primary, children: seg.text }, i));
                case 'code':
                    return (_jsx(Text, { color: theme.colors.accent, children: seg.text }, i));
                case 'strikethrough':
                    return (_jsx(Text, { strikethrough: true, color: theme.colors.text.muted, children: seg.text }, i));
                case 'link':
                    return (_jsx(Text, { color: theme.colors.info, underline: true, children: seg.text }, i));
                default:
                    return _jsx(Text, { children: seg.text }, i);
            }
        }) }));
};
const InlineText = ({ content, theme, }) => {
    const segments = parseInline(content);
    return (_jsx(_Fragment, { children: segments.map((seg, i) => {
            switch (seg.type) {
                case 'bold':
                    return (_jsx(Text, { bold: true, color: theme.colors.text.primary, children: seg.text }, i));
                case 'italic':
                    return (_jsx(Text, { italic: true, color: theme.colors.text.primary, children: seg.text }, i));
                case 'code':
                    return (_jsx(Text, { color: theme.colors.accent, children: seg.text }, i));
                case 'strikethrough':
                    return (_jsx(Text, { strikethrough: true, color: theme.colors.text.muted, children: seg.text }, i));
                case 'link':
                    return (_jsx(Text, { color: theme.colors.info, underline: true, children: seg.text }, i));
                default:
                    return (_jsx(Text, { color: theme.colors.text.primary, children: seg.text }, i));
            }
        }) }));
};
function parseInline(text) {
    const segments = [];
    const tokenPatterns = [
        { type: 'code', regex: /`([^`]+)`/g, group: 1 },
        { type: 'bold', regex: /\*\*([^*]+)\*\*/g, group: 1 },
        { type: 'strikethrough', regex: /~~([^~]+)~~/g, group: 1 },
        { type: 'italic', regex: /(?<!\*)\*([^*]+)\*(?!\*)/g, group: 1 },
        { type: 'link', regex: /\[([^\]]+)\]\([^)]+\)/g, group: 1 },
    ];
    const tokens = [];
    for (const { type, regex, group } of tokenPatterns) {
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(text)) !== null) {
            const start = match.index;
            const end = match.index + match[0].length;
            const overlaps = tokens.some((t) => (start >= t.start && start < t.end) ||
                (end > t.start && end <= t.end));
            if (!overlaps) {
                tokens.push({
                    type,
                    text: match[group],
                    start,
                    end,
                });
            }
        }
    }
    tokens.sort((a, b) => a.start - b.start);
    let lastEnd = 0;
    for (const token of tokens) {
        if (token.start > lastEnd) {
            segments.push({ type: 'text', text: text.slice(lastEnd, token.start) });
        }
        segments.push({ type: token.type, text: token.text });
        lastEnd = token.end;
    }
    if (lastEnd < text.length) {
        segments.push({ type: 'text', text: text.slice(lastEnd) });
    }
    if (segments.length === 0) {
        return [{ type: 'text', text }];
    }
    return segments;
}
export default MessageRenderer;
//# sourceMappingURL=MessageRenderer.js.map