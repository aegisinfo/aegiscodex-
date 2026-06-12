/**
 * Terminal render formatting — plain-text CLI formatting functions.
 *
 * Replicates the formatting interface from free-claude-code's
 * messaging/rendering/discord_markdown.py and telegram_markdown.py,
 * but optimized for terminal/CLI output (no markdown-it parser needed).
 *
 * For a CLI app, we keep it simple: bold via ANSI, code via backticks,
 * and no complex markdown rendering — raw text is fine.
 */
// ==================== Terminal Formatting ====================
/** Bold text using ANSI escape codes */
function termBold(text) {
    return `\x1b[1m${text}\x1b[22m`;
}
/** Inline code — wraps in backticks (no escaping needed for terminal display) */
function termCodeInline(text) {
    return `\`${text}\``;
}
/** Escape text — no-op for terminal; ANSI is fine */
function termEscapeText(text) {
    return text;
}
/** Escape code content — no-op for terminal */
function termEscapeCode(text) {
    return text;
}
/** Render markdown — pass-through for terminal (simple formatting only) */
function termRenderMarkdown(text) {
    return text;
}
/** Default terminal formatting bundle */
export const TERMINAL_FORMATTING = {
    bold: termBold,
    codeInline: termCodeInline,
    escapeText: termEscapeText,
    escapeCode: termEscapeCode,
    renderMarkdown: termRenderMarkdown,
};
/** Plain text formatting bundle (no ANSI escapes) */
export const PLAIN_TEXT_FORMATTING = {
    bold: (t) => t,
    codeInline: (t) => `\`${t}\``,
    escapeText: (t) => t,
    escapeCode: (t) => t,
    renderMarkdown: (t) => t,
};
export function buildRenderContext(options = {}) {
    return {
        formatting: options.formatting ?? TERMINAL_FORMATTING,
        limitChars: options.limitChars ?? 10000,
        thinkingTailMax: options.thinkingTailMax ?? 1000,
        textTailMax: options.textTailMax ?? 2000,
        toolOutputTailMax: options.toolOutputTailMax ?? 1600,
    };
}
//# sourceMappingURL=renderFormatting.js.map