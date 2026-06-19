/**
 * MessageList - renders messages with RAF-throttled streaming content.
 *
 * Owns scroll state internally — no split state with parent.
 * Handles PgUp/PgDn/Ctrl+W/Ctrl+S/Ctrl+Up/Down/Home/End via useInput.
 * No auto-scroll; user controls position fully via keyboard.
 *
 * Why the RAF loop?
 *   vanillaStore.setState() triggers the subscription on every delta, forcing
 *   full Ink reconciliation and a visible terminal "blink" at every tick.
 *   The RAF loop polls the mutable buffer directly and only bumps a LOCAL
 *   counter (streamingVersion) — only MessageList re-renders, nothing else.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { MessageRenderer } from '../markdown/MessageRenderer.js';
import { getState } from '../../../store/index.js';
import { vanillaStore } from '../../../store/vanilla.js';
import { getStreamingContent, isActiveStreamingMessage, getStreamingLatencyMs, getBufferedToolCalls } from '../../../store/streaming-buffer.js';
import { themeManager } from '../../themes/index.js';
import type { ContentBlock } from '../../../store/types.js';

// ── Line estimation for line-based scrolling ──────────────────────────

/** Rough estimate of rendered terminal lines for a text string. */
function estimateContentLines(text: string, terminalWidth: number): number {
  if (!text) return 0;
  const w = Math.max(terminalWidth, 20);
  const raw = text.split('\n');
  let total = 0;
  for (const line of raw) {
    const l = line.length;
    total += l === 0 ? 1 : Math.max(1, Math.ceil(l / w));
  }
  return total;
}

/** Estimate total rendered lines for a message (role line + thinking + content + tool blocks). */
function estimateMessageLines(
  content: string,
  thinking: string | undefined,
  terminalWidth: number,
  contentBlocks?: ContentBlock[],
): number {
  let total = 1; // role prefix line

  // Thinking section
  if (thinking && thinking.length > 0) {
    total += 1; // "thought" header
    total += estimateContentLines(thinking, terminalWidth);
  }

  // Structured content blocks (Claude Code style)
  if (contentBlocks && contentBlocks.length > 0) {
    for (const b of contentBlocks) {
      switch (b.type) {
        case 'thinking':
          total += 1; // "thought" header
          total += estimateContentLines(b.thinking || '', terminalWidth);
          break;
        case 'text':
          total += estimateContentLines(b.text || '', terminalWidth);
          break;
        case 'tool_use':
          total += 2; // ● line + at least one result line
          break;
        case 'tool_result':
          // ToolUseBlock folds results into their paired tool_use block and
          // truncates to a handful of sublines (see MessageRenderer.tsx) —
          // it's never rendered standalone or proportional to full content
          // length. Estimating it that way previously inflated the line
          // budget for messages with large tool output (file reads, bash
          // output), which could exhaust the entire windowing budget in one
          // message and silently drop every message after it — including
          // the next user message — from the visible render.
          total += Math.min(estimateContentLines(b.content || '', terminalWidth), 6);
          break;
      }
    }
    return total;
  }

  // Legacy markdown content
  total += estimateContentLines(content, terminalWidth);
  return total;
}

interface MessageListProps {
  terminalWidth: number;
  terminalHeight: number;
  /** Called when scroll state changes (for status bar indicator) */
  onScrolledUpChange?: (isScrolledUp: boolean) => void;
  /** Called with render latency (ms) during streaming — for status bar display */
  onRenderLatency?: (ms: number) => void;
  /** Number of queued commands shown below the message list (adjusts viewport budget) */
  pendingCommandCount?: number;
}

const RAF_INTERVAL_MS = 30;   // ~33fps redraws
const CONTENT_THRESHOLD = 1;   // re-render on every content character
const THINKING_THRESHOLD = 1; // update thinking content every 1 char for real-time visibility
const UI_OVERHEAD = 6; // rows for input area, status bar, etc.
const MAX_HISTORY_MESSAGES = 200; // hard cap: only show last N completed messages

export const MessageList: React.FC<MessageListProps> = React.memo(({
  terminalWidth,
  terminalHeight,
  onScrolledUpChange,
  onRenderLatency,
  pendingCommandCount = 0,
}) => {
  // ==================== Internal Scroll State ====================
  const [messages, setMessages] = useState(() => getState().session.messages);
  const [showAllThinking, setShowAllThinking] = useState(() => vanillaStore.getState().app.showAllThinking);
  const [streamingVersion, setStreamingVersion] = useState(0);

  // Manual scroll offset — only meaningful while autoFollow is false.
  const [scrollLineOffset, setScrollLineOffset] = useState(0);

  // When true, the view always tracks the live bottom (recomputed fresh every
  // render from maxLineOffset) instead of a stored offset number. estimateMessageLines
  // is only an approximation of what Ink actually renders, so storing the "bottom"
  // as a literal offset let per-message estimate error compound across messages
  // until the stored value drifted from the true bottom — causing messages to
  // appear/disappear inconsistently after a handful of exchanges. Recomputing the
  // bottom fresh every render instead of trusting a remembered number makes it
  // self-correcting, regardless of estimate accuracy.
  const [autoFollow, setAutoFollow] = useState(true);
  const autoFollowRef = useRef(autoFollow);
  autoFollowRef.current = autoFollow;

  // Refs for values used in callbacks/RAF
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const showAllThinkingRef = useRef(showAllThinking);
  showAllThinkingRef.current = showAllThinking;
  const terminalWidthRef = useRef(terminalWidth);
  terminalWidthRef.current = terminalWidth;
  const terminalHeightRef = useRef(terminalHeight);
  terminalHeightRef.current = terminalHeight;
  const onScrolledUpChangeRef = useRef(onScrolledUpChange);
  onScrolledUpChangeRef.current = onScrolledUpChange;
  const onRenderLatencyRef = useRef(onRenderLatency);
  onRenderLatencyRef.current = onRenderLatency;
  const scrollLineOffsetRef = useRef(scrollLineOffset);
  scrollLineOffsetRef.current = scrollLineOffset;
  const maxLineOffsetRef = useRef(0);

  // ==================== Computed values ====================
  const viewportLines = Math.max(terminalHeight - UI_OVERHEAD, 5);
  const allCompleted = messages.filter(msg => !msg.isStreaming);
  const completedMessages = allCompleted.length > MAX_HISTORY_MESSAGES
    ? allCompleted.slice(-MAX_HISTORY_MESSAGES)
    : allCompleted;
  const streamingMsg = messages.find(msg => msg.isStreaming && isActiveStreamingMessage(msg));
  const buffer = streamingMsg ? getStreamingContent() : null;

  // Estimate line counts for each completed message
  const messageLines = useMemo(
    () => completedMessages.map(msg =>
      estimateMessageLines(msg.content, msg.thinking, terminalWidth, msg.contentBlocks),
    ),
    [completedMessages, terminalWidth],
  );

  // Prefix-sum of line offsets: lineOffsets[i] = lines before message i
  // lineOffsets[0] = 0, lineOffsets[N] = totalLines
  const lineOffsets = useMemo(() => {
    const offs: number[] = [0];
    for (let i = 0; i < messageLines.length; i++) {
      offs.push(offs[i] + messageLines[i]);
    }
    return offs;
  }, [messageLines]);

  // Account for streaming message lines in total/max offset.
  // During streaming, the message content lives in the mutable buffer (not the store),
  // so its estimated lines must be added separately. Without this, the scroll position
  // is computed as if the streaming message doesn't exist, causing auto-scroll to land
  // short and push user input off-screen.
  const streamingLines = streamingMsg && buffer
    ? estimateMessageLines(
        streamingMsg.content + buffer.content,
        (streamingMsg.thinking || '') + buffer.thinking,
        terminalWidth,
        streamingMsg.contentBlocks,
      )
    : 0;

  const totalLines = (lineOffsets[lineOffsets.length - 1] || 0) + streamingLines;
  const maxLineOffset = Math.max(0, totalLines - viewportLines);
  maxLineOffsetRef.current = maxLineOffset;
  // While auto-following, always use the freshly-computed bottom rather than a
  // stored offset — see the autoFollow declaration above for why.
  const clampedLineOffset = autoFollow ? maxLineOffset : Math.min(scrollLineOffset, maxLineOffset);
  const isAtBottom = clampedLineOffset >= maxLineOffset;

  // Find which message index corresponds to the current line offset
  const startMsgIndex = useMemo(() => {
    if (lineOffsets.length <= 1) return 0;
    // Binary search: largest i where lineOffsets[i] <= clampedLineOffset
    let lo = 0;
    let hi = lineOffsets.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      if (lineOffsets[mid] <= clampedLineOffset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }, [clampedLineOffset, lineOffsets]);

  // Clamp scrollLineOffset when viewport lines or total content changes
  useEffect(() => {
    setScrollLineOffset(prev => Math.min(prev, maxLineOffset));
  }, [maxLineOffset]);

  // Build visible window: messages whose lines fit within the viewport
  const useWindowing = totalLines > viewportLines;

  let visibleMessages = completedMessages;
  let showLastMsgOutside = false;

  if (useWindowing) {
    visibleMessages = [];
    let linesLeft = viewportLines;
    for (let i = startMsgIndex; i < completedMessages.length && linesLeft > 0; i++) {
      visibleMessages.push(completedMessages[i]);
      linesLeft -= messageLines[i];
    }
    // Pin the latest message below the window when scrolled up, so the user
    // never loses track of "what just happened" while reading history — but
    // only if the window doesn't already end on it, otherwise it'd render twice.
    const windowReachesEnd = visibleMessages.length > 0 &&
      visibleMessages[visibleMessages.length - 1].id === completedMessages[completedMessages.length - 1]?.id;
    showLastMsgOutside = !streamingMsg && !isAtBottom && completedMessages.length > 0 && !windowReachesEnd;
  }

  // ==================== Notify parent about scroll state ====================
  const prevScrolledUpRef = useRef(false);
  useEffect(() => {
    const isScrolledUp = useWindowing && !isAtBottom;
    if (isScrolledUp !== prevScrolledUpRef.current) {
      prevScrolledUpRef.current = isScrolledUp;
      onScrolledUpChangeRef.current?.(isScrolledUp);
    }
  }, [useWindowing, isAtBottom]);

  // ==================== Keyboard Scrolling ====================
  // Manual scroll-up moves: leave autoFollow, basing the new offset on the
  // live bottom (maxLineOffsetRef) if we were following, or the stored
  // offset otherwise.
  function scrollUpBy(amount: number) {
    const base = autoFollowRef.current ? maxLineOffsetRef.current : scrollLineOffsetRef.current;
    setAutoFollow(false);
    setScrollLineOffset(Math.max(0, base - amount));
  }

  // Manual scroll-down moves: re-enable autoFollow once we reach the bottom.
  function scrollDownBy(amount: number) {
    const base = autoFollowRef.current ? maxLineOffsetRef.current : scrollLineOffsetRef.current;
    const max = maxLineOffsetRef.current;
    const next = Math.min(max, base + amount);
    setScrollLineOffset(next);
    setAutoFollow(next >= max);
  }

  useInput((_input, key) => {
    // Page Up — also handle Ctrl+W since terminals often intercept
    // PageUp/PageDown for their own scrollback buffer.
    if (key.pageUp || (key.ctrl && _input === '\x17')) {
      scrollUpBy(viewportLines);
      return;
    }
    if (key.pageDown || (key.ctrl && _input === '\x13')) {
      scrollDownBy(viewportLines);
      return;
    }
    // Half-page scroll (vim Ctrl+U / Ctrl+D)
    if (key.ctrl && _input === '\x15') {
      scrollUpBy(Math.max(1, Math.floor(viewportLines / 2)));
      return;
    }
    if (key.ctrl && _input === '\x04') {
      scrollDownBy(Math.max(1, Math.floor(viewportLines / 2)));
      return;
    }
    if (key.upArrow && key.ctrl) {
      scrollUpBy(1);
      return;
    }
    if (key.downArrow && key.ctrl) {
      scrollDownBy(1);
      return;
    }
    if (key.home) {
      setAutoFollow(false);
      setScrollLineOffset(0);
      return;
    }
    if (key.end) {
      setAutoFollow(true);
      return;
    }
  });

  // ==================== RAF Streaming Loop ====================

  const pendingMessagesRef = useRef<typeof messages | null>(null);
  const lastContentLenRef = useRef<Record<string, { content: number; thinking: number }>>({});
  const rafActiveRef = useRef(false);
  const rafIdRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const lastRafTimeRef = useRef(0);

  function ensureRafRunning() {
    if (rafActiveRef.current) return;
    rafActiveRef.current = true;

    const flushTick = (now: number) => {
      if (!rafActiveRef.current) return;
      if (now - lastRafTimeRef.current < RAF_INTERVAL_MS) {
        rafIdRef.current = requestAnimationFrame(flushTick);
        return;
      }
      lastRafTimeRef.current = now;

      // 1. Apply pending messages in a single batch
      if (pendingMessagesRef.current) {
        const newMessages = pendingMessagesRef.current;
        pendingMessagesRef.current = null;

        setMessages(newMessages);
      }

      // 2. Check and apply buffered streaming content
      const buf = getStreamingContent();
      const state = vanillaStore.getState();
      const streaming = state.session.messages.find(m => m.isStreaming && isActiveStreamingMessage(m));

      if (buf && streaming) {
        const lastLen = lastContentLenRef.current[streaming.id] || { content: 0, thinking: 0 };

        if (lastLen.content > buf.content.length || lastLen.thinking > buf.thinking.length) {
          lastContentLenRef.current[streaming.id] = { content: 0, thinking: 0 };
        }

        const updatedLastLen = lastContentLenRef.current[streaming.id] || { content: 0, thinking: 0 };
        const deltaContent = buf.content.length - updatedLastLen.content;
        const deltaThinking = buf.thinking.length - updatedLastLen.thinking;
        const thinkingJustStarted = updatedLastLen.thinking === 0 && buf.thinking.length > 0;

        if (deltaContent >= CONTENT_THRESHOLD || deltaThinking >= THINKING_THRESHOLD || thinkingJustStarted) {
          lastContentLenRef.current[streaming.id] = {
            content: buf.content.length,
            thinking: buf.thinking.length,
          };
          setStreamingVersion(v => v + 1);

          // While autoFollow is true, the bottom is recomputed fresh every render
          // (see clampedLineOffset above) — no offset bump needed here.

          // Report render latency to status bar
          const latency = getStreamingLatencyMs();
          if (latency > 30) {
            onRenderLatencyRef.current?.(latency);
          }
        }
      }

      // Keep polling if there's pending work.
      // Read `stillStreaming` FRESH from both the buffer and store — the captured
      // `streaming` variable (line 287) is stale by the time we reach here if
      // finishStreamingMessage fired between our read and this check.
      // Race condition: clearBuffer() + set({isStreaming:false}) can flip both
      // sources synchronously between our getStreamingContent() and store reads
      // on different lines. Single-expression evaluation avoids this window.
      const stillHasPending = pendingMessagesRef.current !== null;
      const liveStoreState = vanillaStore.getState();
      const liveStreaming = liveStoreState.session.messages.find(
        m => m.isStreaming && isActiveStreamingMessage(m),
      );
      const stillStreaming = !!(getStreamingContent() && liveStreaming);
      if (stillHasPending || stillStreaming) {
        rafIdRef.current = requestAnimationFrame(flushTick);
      } else {
        rafActiveRef.current = false;
        rafIdRef.current = null;
      }
    };

    rafIdRef.current = requestAnimationFrame(flushTick);
  }

  // ==================== Store Subscription ====================
  useEffect(() => {
    const unsub = vanillaStore.subscribe((state) => {
      const newMessages = state.session.messages;
      const newShowAllThinking = state.app.showAllThinking;
      const prevMessages = messagesRef.current;

      let messagesChanged = false;

      if (newMessages.length !== prevMessages.length) {
        messagesChanged = true;
      } else {
        for (let i = 0; i < newMessages.length; i++) {
          const a = prevMessages[i];
          const b = newMessages[i];
          if (a.id !== b.id || a.isStreaming !== b.isStreaming || a.content !== b.content || a.thinking !== b.thinking || a.contentBlocks !== b.contentBlocks) {
            messagesChanged = true;
            break;
          }
        }
      }

      if (messagesChanged) {
        // Auto-scroll to bottom when new content arrives.
        // Re-enables follow mode when:
        //  - The last new message is a user message (just submitted)
        //  - The last new message is streaming (just started streaming)
        //  - The user was already following (so they keep following the conversation)
        // No offset math here — autoFollow makes the render-time clampedLineOffset
        // track the live bottom every render, so there's nothing to compute or store.
        const prevLen = prevMessages.length;
        const newLen = newMessages.length;
        if (newLen > prevLen) {
          const lastNew = newMessages[newLen - 1];
          if (lastNew?.role === 'user' || lastNew?.isStreaming || autoFollowRef.current) {
            setAutoFollow(true);
          }
        }

        // Always flow through RAF — never bypass with pendingMessagesRef.current = null.
        // The bypass path caused user messages to be lost when a streaming message finished
        // and a new user message arrived in the same synchronous tick.
        pendingMessagesRef.current = [...newMessages];
        ensureRafRunning();
      }

      // Start RAF loop if new streaming message appeared
      if (newMessages.length > 0 && newMessages[newMessages.length - 1].isStreaming) {
        ensureRafRunning();
      }

      // showAllThinking is safe to apply immediately
      if (newShowAllThinking !== showAllThinkingRef.current) {
        setShowAllThinking(newShowAllThinking);
      }

      newMessages.forEach(msg => {
        if (!msg.isStreaming) delete lastContentLenRef.current[msg.id];
      });
    });

    return () => {
      rafActiveRef.current = false;
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==================== Render ====================

  return (
    <Box flexDirection="column">
      {/* Scroll-up indicator — shows lines above current viewport */}
      {useWindowing && !isAtBottom && !streamingMsg && (
        <Box>
          <Text color={themeManager.getTheme().colors.text.muted} dimColor>↑ {clampedLineOffset} lines above</Text>
        </Box>
      )}

      {/* Visible messages */}
      {visibleMessages.map((msg) => (
        <MessageRenderer
          key={msg.id}
          content={msg.content}
          role={msg.role}
          terminalWidth={terminalWidth}
          showPrefix={true}
          thinking={msg.thinking}
          isStreaming={false}
          showAllThinking={showAllThinking}
          contentBlocks={msg.contentBlocks}
        />
      ))}

      {/* Streaming message */}
      {streamingMsg && (() => {
        // Merge content from store + buffer into a single render surface.
        // During streaming, text/thinking live in the mutable buffer as raw strings
        // but the store's contentBlocks array doesn't get text/thinking blocks in
        // real-time (only tool_use blocks are added via addContentBlock).
        //
        // To give ContentBlockRenderer the full picture, we:
        // 1. Keep store tool_use/tool_result blocks (with buffer-merged tool args)
        // 2. Synthesize ONE text block from the entire combined text content
        // 3. Synthesize ONE thinking block from the entire combined thinking
        const combinedContent = buffer ? streamingMsg.content + buffer.content : streamingMsg.content;
        const combinedThinking = buffer ? (streamingMsg.thinking || '') + buffer.thinking : streamingMsg.thinking;
        const storeBlocks = streamingMsg.contentBlocks || [];
        const bufferToolCalls = buffer ? getBufferedToolCalls() : [];

        // Merge buffer tool call arguments into store tool_use blocks
        // (buffer accumulates args via input_json_delta, store block starts as '')
        const enhancedBlocks = storeBlocks.map(b => {
          if (b.type === 'tool_use') {
            const buffered = bufferToolCalls.find(tc => tc.id === b.id);
            if (buffered && buffered.arguments) {
              return { ...b, input: buffered.arguments };
            }
          }
          return b;
        });

        // Filter out store text/thinking blocks — replace with combined versions
        const nonTextBlocks = enhancedBlocks.filter(b => b.type !== 'text' && b.type !== 'thinking');
        const mergedBlocks: ContentBlock[] = [];

        // Natural block order: thinking → text → tool_use → tool_result
        if (combinedThinking) {
          mergedBlocks.push({ type: 'thinking', thinking: combinedThinking });
        }
        if (combinedContent) {
          mergedBlocks.push({ type: 'text', text: combinedContent });
        }
        mergedBlocks.push(...nonTextBlocks);

        return (
          <MessageRenderer
            key={streamingMsg.id}
            content={combinedContent}
            role={streamingMsg.role}
            terminalWidth={terminalWidth}
            showPrefix={true}
            thinking={combinedThinking}
            isStreaming={true}
            showAllThinking={showAllThinking}
            contentBlocks={mergedBlocks}
          />
        );
      })()}

      {/* Last completed message pinned at bottom when scrolled up — divider makes
          clear this jumps past whatever's between the window and the latest
          message, instead of looking like that content silently vanished. */}
      {showLastMsgOutside && (
        <Box>
          <Text color={themeManager.getTheme().colors.text.muted} dimColor>⋯ latest (End to jump here) ⋯</Text>
        </Box>
      )}
      {showLastMsgOutside && (
        <MessageRenderer
          key={'last-' + completedMessages[completedMessages.length - 1].id}
          content={completedMessages[completedMessages.length - 1].content}
          role={completedMessages[completedMessages.length - 1].role}
          terminalWidth={terminalWidth}
          showPrefix={true}
          thinking={completedMessages[completedMessages.length - 1].thinking}
          isStreaming={false}
          showAllThinking={showAllThinking}
          contentBlocks={completedMessages[completedMessages.length - 1].contentBlocks}
        />
      )}
    </Box>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;
