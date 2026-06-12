/**
 * RenderingProfile — platform-specific rendering configuration.
 *
 * Replicates free-claude-code's messaging/rendering/profiles.py.
 * Bundles format_status function, parse_mode, render context, and
 * character limits into a single profile for a given target format.
 */
import type { RenderingProfile } from './types.js';
/** Terminal rendering profile (ANSI bold, backtick code, unlimited chars) */
export declare const TERMINAL_PROFILE: RenderingProfile;
/** Plain text rendering profile (no ANSI, backtick code, suitable for logging) */
export declare const PLAIN_TEXT_PROFILE: RenderingProfile;
/** Compact terminal profile — tighter limits for constrained displays */
export declare const COMPACT_TERMINAL_PROFILE: RenderingProfile;
/**
 * Build a rendering profile by platform name.
 * Replicates build_rendering_profile() from profiles.py.
 */
export declare function buildRenderingProfile(platformName: string): RenderingProfile;
//# sourceMappingURL=RenderingProfile.d.ts.map