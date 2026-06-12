import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * CodeHighlighter - with line-level caching to avoid re-highlighting unchanged lines
 * Supports diff rendering when language === 'diff'
 */
import { useMemo, memo } from 'react';
import { Box, Text } from 'ink';
import { common, createLowlight } from 'lowlight';
import { themeManager } from '../../themes/index.js';
const lowlight = createLowlight(common);
// Line-level cache: avoids re-highlighting the same line content
// Cache raw HAST nodes instead of React elements
const lineHighlightCache = new Map();
function getCachedAst(line, language) {
    const cacheKey = `${language || 'auto'}|${line}`;
    const cached = lineHighlightCache.get(cacheKey);
    if (cached)
        return cached;
    const ast = doHighlightAst(line, language);
    if (lineHighlightCache.size > 2000) {
        const firstKey = lineHighlightCache.keys().next().value;
        if (firstKey)
            lineHighlightCache.delete(firstKey);
    }
    lineHighlightCache.set(cacheKey, ast);
    return ast;
}
function doHighlightAst(line, language) {
    if (!line || line.trim() === '') {
        return { type: 'root', children: [{ type: 'text', value: line || ' ' }] };
    }
    try {
        if (language && lowlight.registered(language)) {
            return lowlight.highlight(language, line);
        }
        if (/^[\s│┌┐└┘├┤┬┴┼─═║╔╗╚╝╠╣╦╩╬|+\-*=<>]+$/.test(line)) {
            return { type: 'root', children: [{ type: 'text', value: line }] };
        }
        return lowlight.highlightAuto(line);
    }
    catch {
        return { type: 'root', children: [{ type: 'text', value: line }] };
    }
}
// ── Diff rendering ──────────────────────────────────────────────────────────
const DIFF_HEADER_RE = /^(diff --git |index |--- |\+\+\+ )/;
const DIFF_HUNK_RE = /^@@ /;
const DIFF_ADD_RE = /^\+/;
const DIFF_DEL_RE = /^\-/;
const DIFF_NBSP_RE = /^ /; // non-breaking space used by some diff outputs
function getDiffLineStyle(line) {
    if (DIFF_HEADER_RE.test(line)) {
        return { prefix: ' ', color: 'yellow' };
    }
    if (DIFF_HUNK_RE.test(line)) {
        return { prefix: ' ', color: 'cyan' };
    }
    if (DIFF_ADD_RE.test(line)) {
        return { prefix: '+', color: 'green' };
    }
    if (DIFF_DEL_RE.test(line)) {
        return { prefix: '-', color: 'red' };
    }
    // context lines
    return { prefix: ' ', color: '' };
}
export const CodeHighlighter = ({ content, language, filePath, showLineNumbers = true, terminalWidth = 80, startLine = 1, }) => {
    const theme = themeManager.getTheme();
    const syntaxColors = theme.colors.syntax;
    const lines = useMemo(() => content.split('\n'), [content]);
    const totalLines = startLine + lines.length - 1;
    const lineNumberWidth = showLineNumbers ? String(totalLines).length + 1 : 0;
    const isDiff = language === 'diff' || language === 'patch';
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: theme.colors.border.light, paddingX: 1, marginY: 1, children: [_jsxs(Box, { marginBottom: 1, justifyContent: "space-between", children: [_jsx(Box, { children: filePath ? (_jsxs(_Fragment, { children: [_jsx(Text, { color: theme.colors.info, children: filePath }), language && (_jsxs(Text, { color: theme.colors.text.muted, dimColor: true, children: [" ", language] }))] })) : language ? (_jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: language })) : null }), _jsx(Box, { children: _jsx(Text, { color: theme.colors.text.muted, dimColor: true, children: "/copy" }) })] }), isDiff ? (_jsx(DiffRenderer, { lines: lines })) : (lines.map((line, index) => {
                const lineNumber = startLine + index;
                return (_jsxs(Box, { flexDirection: "row", children: [showLineNumbers && (_jsx(Box, { width: lineNumberWidth, marginRight: 1, children: _jsx(Text, { dimColor: true, children: String(lineNumber).padStart(lineNumberWidth - 1, ' ') }) })), _jsx(Box, { flexShrink: 1, children: _jsx(CachedHighlightedLine, { line: line, language: language, syntaxColors: syntaxColors }) })] }, index));
            }))] }));
};
/**
 * Memoized per-line component using content-based cache
 */
const CachedHighlightedLine = memo(({ line, language, syntaxColors }) => {
    const ast = useMemo(() => getCachedAst(line, language), [line, language]);
    const rendered = useMemo(() => renderHastNode(ast, syntaxColors), [ast, syntaxColors]);
    return _jsx(_Fragment, { children: rendered });
});
CachedHighlightedLine.displayName = 'CachedHighlightedLine';
function renderHastNode(node, syntaxColors, key) {
    if (node.type === 'text') {
        return _jsx(Text, { children: node.value }, key);
    }
    if (node.type === 'root') {
        return (_jsx(_Fragment, { children: node.children?.map((child, index) => renderHastNode(child, syntaxColors, index)) }));
    }
    if (node.type === 'element') {
        const className = node.properties?.className?.[0] || '';
        const color = getColorForClass(className, syntaxColors);
        const children = node.children?.map((child, index) => renderHastNode(child, syntaxColors, index));
        return (_jsx(Text, { color: color, children: children }, key));
    }
    return _jsx(Text, {}, key);
}
function getColorForClass(className, syntaxColors) {
    if (className.includes('comment') || className.includes('prolog')) {
        return syntaxColors.comment;
    }
    if (className.includes('string') || className.includes('char') || className.includes('template-string')) {
        return syntaxColors.string;
    }
    if (className.includes('number') || className.includes('boolean') || className.includes('constant')) {
        return syntaxColors.number;
    }
    if (className.includes('keyword') || className.includes('selector') || className.includes('important')) {
        return syntaxColors.keyword;
    }
    if (className.includes('function') || className.includes('method')) {
        return syntaxColors.function;
    }
    if (className.includes('variable') || className.includes('property')) {
        return syntaxColors.variable;
    }
    if (className.includes('operator') || className.includes('punctuation')) {
        return syntaxColors.operator;
    }
    if (className.includes('type') || className.includes('class-name') || className.includes('builtin')) {
        return syntaxColors.type;
    }
    if (className.includes('tag') || className.includes('name')) {
        return syntaxColors.tag;
    }
    if (className.includes('attr')) {
        return syntaxColors.attr;
    }
    return syntaxColors.default;
}
// ── Diff Renderer ──────────────────────────────────────────────────────────
const DiffRenderer = memo(({ lines }) => {
    return (_jsx(_Fragment, { children: lines.map((line, index) => {
            const style = getDiffLineStyle(line);
            if (!style) {
                // fallback: render as plain text
                return (_jsx(Box, { flexDirection: "row", children: _jsx(Text, { children: line }) }, index));
            }
            const { prefix: stylePrefix, color, bold } = style;
            // Strip the first character (+/-) for display and show it as prefix instead
            const displayText = color
                ? (DIFF_ADD_RE.test(line) || DIFF_DEL_RE.test(line)
                    ? line.slice(1)
                    : line)
                : line;
            return (_jsxs(Box, { flexDirection: "row", children: [_jsx(Box, { width: 2, flexShrink: 0, children: _jsx(Text, { bold: bold, color: color || undefined, children: stylePrefix }) }), _jsx(Box, { flexShrink: 1, children: _jsx(Text, { color: color || undefined, bold: bold, children: displayText }) })] }, index));
        }) }));
});
DiffRenderer.displayName = 'DiffRenderer';
export default CodeHighlighter;
//# sourceMappingURL=CodeHighlighter.js.map