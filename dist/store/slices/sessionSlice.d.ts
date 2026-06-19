/**
 * Session Slice - 会话状态管理
 *
 * Streaming Architecture (Buffer + Store):
 *
 * During streaming, content deltas arrive at high frequency (per-character).
 * Writing each delta to the zustand store triggers cascading re-renders
 * across ALL subscribers — causing visible terminal "blink".
 *
 * Solution: External mutable buffer (streaming-buffer.ts).
 *   - deltas → appendToBuffer() — O(1), no store update
 *   - MessageList RAF loop polls buffer directly — only MessageList re-renders
 *   - Store updated only at: start, flush (tool calls), finish
 *
 * flushStreamBuffer → drainBuffer() → store.set() → initStreamingBuffer()
 *   Used mid-streaming (e.g., before a tool call) to persist content to store
 *   while keeping the buffer alive for subsequent deltas.
 *
 * finishStreamingMessage → drainBuffer() → store.set() (isStreaming=false)
 *   Finalizes the message. No re-init — streaming is done.
 */
import type { StateCreator } from 'zustand';
import type { ClawdStore, SessionSlice } from '../types.js';
export declare const createSessionSlice: StateCreator<ClawdStore, [
], [
], SessionSlice>;
//# sourceMappingURL=sessionSlice.d.ts.map