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
import type { RenderContext } from './types.js';
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
export class ThrottledRenderer {
  private _transcript: TranscriptBuffer;
  private _renderCtx: RenderContext;
  private _outputCallback: RenderOutputCallback;
  private _throttleMs: number;
  private _debug: boolean;

  private _lastUpdate = 0;
  private _lastDisplayedText: string | null = null;
  private _lastStatus: string | null = null;
  private _pendingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    transcript: TranscriptBuffer,
    profile: RenderingProfile,
    outputCallback: RenderOutputCallback,
    options: ThrottledRendererOptions = {},
  ) {
    this._transcript = transcript;
    this._renderCtx = profile.renderCtx;
    this._outputCallback = outputCallback;
    this._throttleMs = options.throttleMs ?? 1000;
    this._debug = options.debug ?? false;
  }

  get lastStatus(): string | null {
    return this._lastStatus;
  }

  /**
   * Update the rendered output.
   * @param status Optional status line to append below transcript
   * @param force If true, skip throttling and render immediately
   */
  async update(status?: string | null, force = false): Promise<void> {
    const now = Date.now();

    if (status !== undefined && status !== null) {
      this._lastStatus = status;
    }

    if (!force && now - this._lastUpdate < this._throttleMs) {
      // Schedule a pending update in case no more events arrive
      if (!this._pendingTimer) {
        this._pendingTimer = setTimeout(() => {
          this._pendingTimer = null;
          this._doUpdate().catch(() => {});
        }, this._throttleMs);
      }
      return;
    }

    // Clear any pending timer
    if (this._pendingTimer) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = null;
    }

    await this._doUpdate();
  }

  private async _doUpdate(): Promise<void> {
    this._lastUpdate = Date.now();

    let display: string;
    try {
      display = this._transcript.render(this._renderCtx, this._lastStatus ?? undefined);
    } catch (err) {
      if (this._debug) {
        console.error('[ThrottledRenderer] render failed:', err);
      }
      return;
    }

    if (!display && !this._lastDisplayedText) {
      return;
    }

    if (display === this._lastDisplayedText) {
      return; // dedup
    }

    this._lastDisplayedText = display;

    try {
      await this._outputCallback(display);
    } catch (err) {
      if (this._debug) {
        console.error('[ThrottledRenderer] output callback failed:', err);
      }
    }
  }

  /** Reset internal state (for new turns) */
  reset(): void {
    this._lastUpdate = 0;
    this._lastDisplayedText = null;
    this._lastStatus = null;
    if (this._pendingTimer) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = null;
    }
  }
}
