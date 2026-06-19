import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
    const isThinkingExpanded = true;
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
    const prefixOffset = showPrefix && roleStyle && roleStyle.prefix ? roleStyle.prefix.length + 1 : 0;
    const hasToolBlocks = contentBlocks && contentBlocks.some(b => b.type === 'tool_use' || b.type === 'tool_result');
    // ===== Content-block-driven rendering (Claude Code style) =====
    // When contentBlocks are present, render from the structured block model
    // instead of the flat markdown string.
    const shouldUseContentBlocks = contentBlocks && contentBlocks.length > 0;
    // User messages: "You" label + content, clearly separated
    if (role === 'user') {
        return (_jsx(Box, { flexDirection: "column", marginBottom: 1, marginTop: 0, children: _jsxs(Box, { flexDirection: "row", children: [_jsxs(Box, { marginRight: 1, flexShrink: 0, children: [_jsx(Text, { color: theme.colors.primary, bold: true, children: "You" }), _jsx(Text, { color: theme.colors.border.light, children: ":" })] }), _jsx(Box, { flexGrow: 1, children: _jsx(Text, { color: theme.colors.text.primary, wrap: "wrap", children: content }) })] }) }));
    }
    return (_jsxs(Box, { flexDirection: "column", marginBottom: 0, children: [shouldUseContentBlocks ? (_jsx(ContentBlockRenderer, { contentBlocks: contentBlocks, content: content, theme: theme, isStreaming: isStreaming, roleStyle: roleStyle, terminalWidth: terminalWidth, prefixOffset: prefixOffset })) : (_jsxs(_Fragment, { children: [!!thinking && (_jsx(Box, { flexDirection: "column", children: isStreaming ? (_jsxs(_Fragment, { children: [_jsx(Box, { children: _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [_jsx(ThinkingIcon, {}), _jsx(Text, { color: theme.colors.text.muted, dimColor: true, italic: true, children: "thinking" })] }) }), _jsx(Box, { flexDirection: "column", marginLeft: 0, children: filteredThinkingBlocks.map((block, index) => (_jsx(Box, { children: _jsx(Text, { color: theme.colors.text.muted, dimColor: true, italic: true, children: block.content }) }, index))) })] })) : thinking.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(Box, { children: _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [_jsx(Text, { color: theme.colors.primary, children: '□ ' }), _jsx(Text, { color: theme.colors.text.muted, dimColor: true, italic: true, children: "thought" })] }) }), _jsx(Box, { flexDirection: "column", marginLeft: 0, children: filteredThinkingBlocks.map((block, index) => (_jsx(Box, { children: _jsx(Text, { color: theme.colors.text.muted, dimColor: true, italic: true, children: block.content }) }, index))) })] })) : null })), filteredBlocks.map((block, index) => (_jsx(BlockRenderer, { block: block, isFirst: index === 0 && filteredThinkingBlocks.length === 0, roleStyle: showPrefix ? roleStyle : undefined, terminalWidth: terminalWidth, theme: theme }, index)))] })), !shouldUseContentBlocks && hasToolBlocks && (_jsx(ActionsBlock, { contentBlocks: contentBlocks, theme: theme, prefixOffset: prefixOffset })), isStreaming && (_jsx(StreamingCursor, { prefixOffset: prefixOffset, hasContent: content.length > 0 || (thinking?.length ?? 0) > 0 }))] }));
}, messageRendererComparator);
MessageRenderer.displayName = 'MessageRenderer';
/**
 * ContentBlockRenderer — renders structured content blocks inline.
 * Matches Claude Code's rendering: text blocks as markdown, thinking blocks inline,
 * tool_use blocks as ● colored lines, all in sequence.
 */
const ContentBlockRenderer = React.memo(({ contentBlocks, content, theme, isStreaming, roleStyle, terminalWidth, prefixOffset, }) => {
    const roleStyleWithPrefix = roleStyle && roleStyle.prefix ? roleStyle : undefined;
    // Local variable tracks prefix emission within a single render pass.
    // Unlike useRef, a local variable doesn't need reset logic and has no
    // stale-closure risk — it's recreated each render.
    let prefixEmitted = false;
    const emitPrefix = () => {
        if (prefixEmitted || !roleStyleWithPrefix)
            return null;
        prefixEmitted = true;
        return (_jsx(Box, { marginRight: 1, children: _jsx(Text, { color: roleStyleWithPrefix.color, bold: roleStyleWithPrefix.bold, children: roleStyleWithPrefix.prefix }) }));
    };
    return (_jsxs(_Fragment, { children: [contentBlocks.map((block, idx) => {
                if (block.type === 'thinking') {
                    // A thinking block is "active" during streaming — the buffer's thinking
                    // content is still being accumulated. Using idx === last-block check
                    // fails when text blocks are merged before tool blocks (thinking is always
                    // the first synthesized block, never the last).
                    const isActive = isStreaming && block.thinking.length > 0;
                    const filtered = parseMarkdown(block.thinking).filter(b => b.type !== 'empty');
                    return (_jsxs(Box, { flexDirection: "column", children: [emitPrefix(), isActive ? (_jsxs(_Fragment, { children: [_jsx(Box, { children: _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [_jsx(ThinkingIcon, {}), _jsx(Text, { color: theme.colors.text.muted, dimColor: true, italic: true, children: "thinking" })] }) }), _jsx(Box, { flexDirection: "column", marginLeft: 2, children: filtered.map((b, i) => (_jsx(Box, { children: _jsx(Text, { color: theme.colors.text.muted, dimColor: true, italic: true, children: b.content }) }, i))) })] })) : block.thinking ? (_jsxs(_Fragment, { children: [_jsx(Box, { children: _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [_jsx(Text, { color: theme.colors.primary, children: '□ ' }), _jsx(Text, { color: theme.colors.text.muted, dimColor: true, italic: true, children: "thought" })] }) }), _jsx(Box, { flexDirection: "column", marginLeft: 2, children: filtered.map((b, i) => (_jsx(Box, { children: _jsx(Text, { color: theme.colors.text.muted, dimColor: true, italic: true, children: b.content }) }, i))) })] })) : null] }, `cb-think-${idx}`));
                }
                if (block.type === 'text') {
                    const parsed = parseMarkdown(block.text);
                    const filtered = parsed.filter(b => b.type !== 'empty');
                    return (_jsxs(Box, { flexDirection: "column", children: [emitPrefix(), filtered.map((b, i) => (_jsx(BlockRenderer, { block: b, isFirst: false, roleStyle: undefined, terminalWidth: terminalWidth, theme: theme }, i)))] }, `cb-text-${idx}`));
                }
                if (block.type === 'tool_use') {
                    const result = contentBlocks.find(b => b.type === 'tool_result' && b.tool_use_id === block.id);
                    return (_jsx(ToolUseBlock, { block: block, result: result, theme: theme, prefixOffset: prefixOffset }, `cb-tool-${block.id || idx}`));
                }
                return null;
            }), content && (!contentBlocks || contentBlocks.every(b => b.type !== 'text')) && (_jsxs(Box, { flexDirection: "column", children: [emitPrefix(), parseMarkdown(content)
                        .filter(b => b.type !== 'empty')
                        .map((b, i) => (_jsx(BlockRenderer, { block: b, isFirst: false, roleStyle: undefined, terminalWidth: terminalWidth, theme: theme }, i)))] }, "remaining-text"))] }));
}, (prev, next) => prev.contentBlocks === next.contentBlocks &&
    prev.content === next.content &&
    prev.isStreaming === next.isStreaming &&
    prev.terminalWidth === next.terminalWidth &&
    prev.prefixOffset === next.prefixOffset &&
    prev.theme.colors === next.theme.colors);
// ===== Streaming Cursor Component (animated) =====
// Braille spinner — shown before first token (matches Claude Code style)
const SPIN_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPIN_INTERVAL = 80;
// Smooth breathing bar — shown while text is streaming
const CURSOR_FRAMES = ['▏', '▎', '▍', '▌', '▌', '▍', '▎', '▏', '▏', ' ', ' ', ' '];
const CURSOR_INTERVAL = 65;
const StreamingCursor = React.memo(({ prefixOffset, hasContent }) => {
    const theme = themeManager.getTheme();
    const [frame, setFrame] = useState(0);
    useEffect(() => {
        setFrame(0);
        const interval = setInterval(() => setFrame(f => (f + 1) % (hasContent ? CURSOR_FRAMES.length : SPIN_FRAMES.length)), hasContent ? CURSOR_INTERVAL : SPIN_INTERVAL);
        return () => clearInterval(interval);
    }, [hasContent]);
    return (_jsx(Box, { marginLeft: prefixOffset, children: _jsx(Text, { color: theme.colors.primary, children: hasContent ? CURSOR_FRAMES[frame] : SPIN_FRAMES[frame] }) }));
});
StreamingCursor.displayName = 'StreamingCursor';
// ===== Animated thinking icon =====
const THINK_FRAMES = ['◌', '○', '◎', '●', '◎', '○'];
const THINK_INTERVAL = 180;
const ThinkingIcon = React.memo(() => {
    const theme = themeManager.getTheme();
    const [frame, setFrame] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setFrame(f => (f + 1) % THINK_FRAMES.length), THINK_INTERVAL);
        return () => clearInterval(t);
    }, []);
    return _jsxs(Text, { color: theme.colors.primary, children: [THINK_FRAMES[frame], ' '] });
});
ThinkingIcon.displayName = 'ThinkingIcon';
const ToolUseBlock = React.memo(({ block, result, theme, prefixOffset, }) => {
    const isError = block.status === 'error';
    const isRunning = block.status === 'running';
    const dotColor = isError ? DOT_ERR : isRunning ? DOT_RUN : DOT_OK;
    const elapsed = block.completedAt ? formatElapsed(block.completedAt - block.startedAt) : null;
    const summary = getToolSummary(block.name, block.input);
    const { label, path } = splitToolSummary(summary);
    const subLines = [];
    if (result?.content) {
        const lines = result.content.split('\n').filter(l => l.trim());
        const diffLines = lines.filter(l => /^[+-]/.test(l) && !l.startsWith('+++') && !l.startsWith('---'));
        if (diffLines.length > 0) {
            const added = diffLines.filter(l => l.startsWith('+')).length;
            const removed = diffLines.filter(l => l.startsWith('-')).length;
            if (added > 0 || removed > 0) {
                subLines.push({ text: `${added > 0 ? `+${added}` : ''}${removed > 0 ? ` -${removed}` : ''} lines`, isUrl: false });
            }
            diffLines.slice(0, 5).forEach(l => {
                subLines.push({ text: l, isUrl: false, isDiff: true, diffType: l.startsWith('+') ? '+' : '-' });
            });
        }
        else {
            lines.slice(0, 4).forEach(line => {
                const trimmed = line.length > 100 ? line.slice(0, 97) + '…' : line;
                subLines.push({ text: trimmed, isUrl: /^https?:\/\//.test(trimmed) });
            });
        }
    }
    return (_jsxs(Box, { flexDirection: "column", marginLeft: prefixOffset, children: [_jsxs(Box, { children: [_jsx(Text, { color: dotColor, bold: true, children: '● ' }), _jsx(Text, { color: theme.colors.text.primary, bold: true, children: label }), path && _jsx(Text, { color: isError ? DOT_ERR : DOT_OK, children: path }), elapsed && _jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [' ', elapsed] })] }), subLines.map((sub, i) => (_jsxs(Box, { marginLeft: 2, children: [_jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: i === 0 ? '└ ' : '  ' }), sub.isDiff ? (_jsx(Box, { backgroundColor: sub.diffType === '+' ? '#0d2b0d' : '#2b0d0d', children: _jsx(Text, { color: sub.diffType === '+' ? DOT_OK : DOT_ERR, children: sub.text }) })) : sub.isUrl ? (_jsx(Text, { color: "#58a6ff", underline: true, children: sub.text })) : (_jsx(Text, { color: isError ? DOT_ERR : theme.colors.text.muted, dimColor: !isError, children: sub.text }))] }, i)))] }));
}, (prev, next) => prev.block === next.block &&
    prev.result === next.result &&
    prev.theme === next.theme &&
    prev.prefixOffset === next.prefixOffset);
ToolUseBlock.displayName = 'ToolUseBlock';
// ===== Tool Call Visual Components =====
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
            case 'Task': {
                const tasks = Array.isArray(args.tasks) ? args.tasks : [];
                if (tasks.length === 0)
                    return name;
                const first = String(tasks[0]?.description || '');
                const summary = tasks.length > 1 ? `${first} +${tasks.length - 1} more` : first;
                return `${name}(${summary.length > 45 ? summary.slice(0, 42) + '…' : summary})`;
            }
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
// ===== Colors =====
const DOT_OK = '#3fb950';
const DOT_ERR = '#f85149';
const DOT_RUN = '#e3b341';
const ActionsBlock = React.memo(({ contentBlocks, theme, prefixOffset }) => {
    const toolBlocks = contentBlocks.filter(b => b.type === 'tool_use');
    if (toolBlocks.length === 0)
        return null;
    return (_jsx(Box, { flexDirection: "column", children: contentBlocks.map((block, idx) => {
            if (block.type !== 'tool_use')
                return null;
            const result = contentBlocks.find(b => b.type === 'tool_result' && b.tool_use_id === block.id);
            return (_jsx(ToolUseBlock, { block: block, result: result, theme: theme, prefixOffset: 0 }, `action-${block.id || idx}`));
        }) }));
}, (prev, next) => prev.contentBlocks === next.contentBlocks &&
    prev.theme === next.theme &&
    prev.prefixOffset === next.prefixOffset);
const BlockRenderer = React.memo(({ block, isFirst, roleStyle, terminalWidth, theme, }) => {
    const prefixWidth = roleStyle?.prefix.length ?? 0;
    const contentWidth = terminalWidth - prefixWidth - 2;
    if (block.type === 'empty') {
        return null;
    }
    const roleStyleWithPrefix = roleStyle && roleStyle.prefix ? roleStyle : undefined;
    return (_jsxs(Box, { flexDirection: "row", children: [isFirst && roleStyleWithPrefix && (_jsx(Box, { marginRight: 1, children: _jsx(Text, { color: roleStyleWithPrefix.color, bold: roleStyleWithPrefix.bold, children: roleStyleWithPrefix.prefix }) })), !isFirst && roleStyleWithPrefix && _jsx(Box, { width: prefixWidth + 1 }), _jsx(Box, { flexGrow: 1, flexShrink: 1, children: block.type === 'code' ? (_jsx(CodeBlock, { content: block.content, language: block.language, filePath: block.filePath, theme: theme })) : block.type === 'heading' ? (_jsx(Heading, { content: block.content, level: block.level || 1, theme: theme })) : block.type === 'list' ? (_jsx(ListItem, { content: block.content, listType: block.listType, marker: block.marker, indent: block.indent, theme: theme })) : block.type === 'hr' ? (_jsx(HorizontalRule, { width: contentWidth, theme: theme })) : block.type === 'table' && block.tableData ? (_jsx(TableRenderer, { headers: block.tableData.headers, rows: block.tableData.rows, alignments: block.tableData.alignments, theme: theme, maxWidth: contentWidth })) : block.type === 'blockquote' ? (_jsx(Blockquote, { content: block.content, theme: theme })) : (_jsx(TextBlock, { content: block.content, theme: theme })) })] }));
}, (prev, next) => prev.block === next.block &&
    prev.isFirst === next.isFirst &&
    prev.terminalWidth === next.terminalWidth &&
    prev.theme === next.theme);
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
/**
 * Get theme-aware diff color for Before/After table columns.
 * Returns theme.colors.error for "before"-like headers,
 * theme.colors.success for "after"-like headers.
 */
function getDiffColumnColor(header, theme) {
    const h = header.trim().toLowerCase();
    if (/^(before|old|previous|removed?|from)$/.test(h))
        return theme.colors.error;
    if (/^(after|new|updated?|added?|to)$/.test(h))
        return theme.colors.success;
    return null;
}
const MIN_COL_WIDTH = 6;
const TRUNCATION_MARKER = '…';
/** Truncate cell content to fit within `maxWidth`, appending `…` if cut. */
function truncateCell(content, maxWidth) {
    const cleaned = stripMarkdownForWidth(content);
    const raw = stringWidth(cleaned);
    if (raw <= maxWidth)
        return renderRawCell(content, maxWidth, 'left');
    // Find safe truncation point respecting ansi / markdown
    let visible = 0;
    let i = 0;
    const chars = [...content];
    for (; i < chars.length; i++) {
        const ch = chars[i];
        visible += stringWidth(ch);
        if (visible > maxWidth - 1)
            break;
    }
    return content.slice(0, i) + TRUNCATION_MARKER;
}
function renderRawCell(content, width, align) {
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
}
const TableRenderer = ({ headers, rows, alignments, theme, maxWidth }) => {
    const borderCost = 1 + headers.length * 2; // leading + each col pair (cell│)
    const available = maxWidth - borderCost - 2; // safety margin
    // 1. Compute natural column widths
    const naturalWidths = headers.map((header, index) => {
        const headerWidth = stringWidth(stripMarkdownForWidth(header));
        const maxRowWidth = Math.max(0, ...rows.map((row) => stringWidth(stripMarkdownForWidth(row[index] || ''))));
        return Math.max(headerWidth, maxRowWidth) + 2;
    });
    const totalNatural = naturalWidths.reduce((a, b) => a + b, 0);
    // 2. Clamp column widths if they exceed available space
    const columnWidths = totalNatural <= available
        ? naturalWidths
        : naturalWidths.map((w) => Math.max(MIN_COL_WIDTH, Math.floor(w * (available / totalNatural))));
    const truncated = totalNatural > available;
    // Detect if any column is a diff column (Before/After/etc.)
    const diffColors = headers.map(h => getDiffColumnColor(h, theme));
    const isDiffTable = diffColors.some(c => c !== null);
    const renderCell = (content, width, align) => {
        if (truncated) {
            return truncateCell(content, width);
        }
        return renderRawCell(content, width, align);
    };
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsxs(Box, { children: [_jsx(Text, { color: theme.colors.border.light, children: "\u2502" }), headers.map((header, index) => {
                        const diffColor = diffColors[index];
                        return (_jsxs(React.Fragment, { children: [_jsx(Text, { bold: true, color: diffColor ?? theme.colors.primary, children: renderCell(header, columnWidths[index], alignments[index] || 'left') }), _jsx(Text, { color: theme.colors.border.light, children: "\u2502" })] }, index));
                    })] }), _jsxs(Box, { children: [_jsx(Text, { color: theme.colors.border.light, children: "\u251C" }), columnWidths.map((width, index) => (_jsxs(React.Fragment, { children: [_jsx(Text, { color: theme.colors.border.light, children: '─'.repeat(width) }), _jsx(Text, { color: theme.colors.border.light, children: index < columnWidths.length - 1 ? '┼' : '┤' })] }, index)))] }), rows.map((row, rowIndex) => (_jsxs(Box, { children: [_jsx(Text, { color: theme.colors.border.light, children: "\u2502" }), headers.map((_, colIndex) => {
                        const cellContent = row[colIndex] || '';
                        const renderedContent = renderCell(cellContent, columnWidths[colIndex], alignments[colIndex] || 'left');
                        const diffColor = diffColors[colIndex];
                        const hasInlineFormat = /\*\*|`|~~|\[.*\]\(/.test(cellContent);
                        return (_jsxs(React.Fragment, { children: [diffColor ? (_jsx(Text, { color: diffColor, dimColor: rowIndex % 2 === 0, children: renderedContent })) : hasInlineFormat ? (_jsx(Text, { children: _jsx(InlineText, { content: renderedContent, theme: theme }) })) : (_jsx(Text, { children: renderedContent })), _jsx(Text, { color: theme.colors.border.light, children: "\u2502" })] }, colIndex));
                    })] }, rowIndex))), truncated && (_jsx(Box, { children: _jsx(Text, { dimColor: true, color: theme.colors.text.secondary, children: `  ╚══ ${TRUNCATION_MARKER} columns scaled to fit terminal width (${maxWidth} cols)` }) }))] }));
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