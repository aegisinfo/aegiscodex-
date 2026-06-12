/**
 * RenderingProfile — platform-specific rendering configuration.
 *
 * Replicates free-claude-code's messaging/rendering/profiles.py.
 * Bundles format_status function, parse_mode, render context, and
 * character limits into a single profile for a given target format.
 */
import { TERMINAL_FORMATTING, PLAIN_TEXT_FORMATTING, buildRenderContext, } from './renderFormatting.js';
/**
 * Format a status line: emoji + bold(label) [+ suffix].
 * Replicates the format_status function from discord/telegram markdown modules.
 */
function formatStatus(emoji, label, suffix, formatting = TERMINAL_FORMATTING) {
    const base = `${emoji} ${formatting.bold(label)}`;
    if (suffix) {
        return `${base} ${formatting.escapeText(suffix)}`;
    }
    return base;
}
/** Status formatter using terminal formatting */
function termFormatStatus(emoji, label, suffix) {
    return formatStatus(emoji, label, suffix, TERMINAL_FORMATTING);
}
/** Status formatter using plain text (no ANSI) */
function plainFormatStatus(emoji, label, suffix) {
    return formatStatus(emoji, label, suffix, PLAIN_TEXT_FORMATTING);
}
// ==================== Pre-built Profiles ====================
/** Terminal rendering profile (ANSI bold, backtick code, unlimited chars) */
export const TERMINAL_PROFILE = {
    formatStatus: termFormatStatus,
    parseMode: null,
    renderCtx: buildRenderContext({ formatting: TERMINAL_FORMATTING, limitChars: 100000 }),
    limitChars: 100000,
};
/** Plain text rendering profile (no ANSI, backtick code, suitable for logging) */
export const PLAIN_TEXT_PROFILE = {
    formatStatus: plainFormatStatus,
    parseMode: null,
    renderCtx: buildRenderContext({ formatting: PLAIN_TEXT_FORMATTING, limitChars: 100000 }),
    limitChars: 100000,
};
/** Compact terminal profile — tighter limits for constrained displays */
export const COMPACT_TERMINAL_PROFILE = {
    formatStatus: termFormatStatus,
    parseMode: null,
    renderCtx: buildRenderContext({
        formatting: TERMINAL_FORMATTING,
        limitChars: 4000,
        thinkingTailMax: 500,
        textTailMax: 1000,
        toolOutputTailMax: 800,
    }),
    limitChars: 4000,
};
/**
 * Build a rendering profile by platform name.
 * Replicates build_rendering_profile() from profiles.py.
 */
export function buildRenderingProfile(platformName) {
    switch (platformName) {
        case 'terminal':
            return TERMINAL_PROFILE;
        case 'compact':
            return COMPACT_TERMINAL_PROFILE;
        case 'plain':
            return PLAIN_TEXT_PROFILE;
        default:
            return TERMINAL_PROFILE;
    }
}
//# sourceMappingURL=RenderingProfile.js.map