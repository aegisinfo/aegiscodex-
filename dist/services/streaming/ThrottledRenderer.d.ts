/**
 * ThrottledRenderer — rate-limited transcript rendering with status lines.
 *
 * Replicates free-claude-code's ThrottledTranscriptEditor (messaging/ui_updates.py)
 * plus the UI update loop from node_event_pipeline.py process_parsed_cli_event().
 *
 * Key behaviors:
 * 1. Throttles to 1 update per second (configurable)
 * 2. Deduplicates — skips if rendered text hasn't changed
 * 3. Handles status line attachment
 * 4. Integrates with RenderingProfile for platform-specific formatting
 */
import { TranscriptBuffer } from './TranscriptBuffer.js';
import type { RenderingProfile } from './types.js';
/** Callback type for delivering rendered output */
export type RenderOutputCallback = (text: string) => void | Promise<void>;
export interface ThrottledRendererOptions {
    /** Throttle interval in ms (default 1000) */
    throttleMs?: number;
    /** Debug logging */
    debug?: boolean;
}
/**
 * ThrottledRenderer — drives transcript rendering with rate limiting.
 *
 * Usage:
 *   const renderer = new ThrottledRenderer(transcript, profile, outputCallback);
 *   await renderer.update('🔄 Processing...');    // throttled
 *   await renderer.update('✅ Complete', true);    // forced (no throttle)
 */
export declare class ThrottledRenderer {
    private _transcript;
    private _renderCtx;
    private _outputCallback;
    private _throttleMs;
    private _debug;
    private _lastUpdate;
    private _lastDisplayedText;
    private _lastStatus;
    private _pendingTimer;
    constructor(transcript: TranscriptBuffer, profile: RenderingProfile, outputCallback: RenderOutputCallback, options?: ThrottledRendererOptions);
    get lastStatus(): string | null;
    /**
     * Update the rendered output.
     * @param status Optional status line to append below transcript
     * @param force If true, skip throttling and render immediately
     */
    update(status?: string | null, force?: boolean): Promise<void>;
    private _doUpdate;
    /** Reset internal state (for new turns) */
    reset(): void;
}
//# sourceMappingURL=ThrottledRenderer.d.ts.map