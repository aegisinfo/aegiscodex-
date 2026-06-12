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
/** Default terminal formatting bundle */
export declare const TERMINAL_FORMATTING: RenderFormatting;
/** Plain text formatting bundle (no ANSI escapes) */
export declare const PLAIN_TEXT_FORMATTING: RenderFormatting;
export interface BuildRenderContextOptions {
    formatting?: RenderFormatting;
    limitChars?: number;
    thinkingTailMax?: number;
    textTailMax?: number;
    toolOutputTailMax?: number;
}
export declare function buildRenderContext(options?: BuildRenderContextOptions): RenderContext;
//# sourceMappingURL=renderFormatting.d.ts.map