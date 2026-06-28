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

import type { RenderFormatting, RenderContext } from './types.js';

// ==================== Terminal Formatting ====================

/** Bold text using ANSI escape codes */
function termBold(text: string): string {
  return `\x1b[1m${text}\x1b[22m`;
}

/** Inline code — wraps in backticks (no escaping needed for terminal display) */
function termCodeInline(text: string): string {
  return `\`${text}\``;
}

/** Escape text — no-op for terminal; ANSI is fine */
function termEscapeText(text: string): string {
  return text;
}

/** Escape code content — no-op for terminal */
function termEscapeCode(text: string): string {
  return text;
}

/** Render markdown — pass-through for terminal (simple formatting only) */
function termRenderMarkdown(text: string): string {
  return text;
}

/** Default terminal formatting bundle */
export const TERMINAL_FORMATTING: RenderFormatting = {
  bold: termBold,
  codeInline: termCodeInline,
  escapeText: termEscapeText,
  escapeCode: termEscapeCode,
  renderMarkdown: termRenderMarkdown,
};

/** Plain text formatting bundle (no ANSI escapes) */
export const PLAIN_TEXT_FORMATTING: RenderFormatting = {
  bold: (t: string) => t,
  codeInline: (t: string) => `\`${t}\``,
  escapeText: (t: string) => t,
  escapeCode: (t: string) => t,
  renderMarkdown: (t: string) => t,
};

// ==================== Render Context Builders ====================

export interface BuildRenderContextOptions {
  formatting?: RenderFormatting;
  limitChars?: number;
  thinkingTailMax?: number;
  textTailMax?: number;
  toolOutputTailMax?: number;
}

export function buildRenderContext(
  options: BuildRenderContextOptions = {}
): RenderContext {
  return {
    formatting: options.formatting ?? TERMINAL_FORMATTING,
    limitChars: options.limitChars ?? 10000,
    thinkingTailMax: options.thinkingTailMax ?? 1000,
    textTailMax: options.textTailMax ?? 2000,
    toolOutputTailMax: options.toolOutputTailMax ?? 1600,
  };
}
