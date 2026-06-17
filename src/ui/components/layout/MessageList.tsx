/**
 * MessageList - renders messages with RAF-throttled streaming content.
 *
 * Owns scroll state internally — no split state with parent.
 * Handles PgUp/PgDn/Ctrl+Up/Down/Home/End via useInput.
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
import { getStreamingContent, isActiveStreamingMessage, getStreamingLatencyMs } from '../../../store/streaming-buffer.js';
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
          total += estimateContentLines(b.content || '', terminalWidth);
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
}) => {
  // ==================== Internal Scroll State ====================
  const [messages, setMessages] = useState(() => getState().session.messages);
  const [showAllThinking, setShowAllThinking] = useState(() => vanillaStore.getState().app.showAllThinking);
  const [streamingVersion, setStreamingVersion] = useState(0);

  // Start scrolled to bottom on mount so the latest messages are visible
  const [scrollLineOffset, setScrollLineOffset] = useState(() => {
    const msgs = getState().session.messages.filter(m => !m.isStreaming);
    const capped = msgs.length > MAX_HISTORY_MESSAGES ? msgs.slice(-MAX_HISTORY_MESSAGES) : msgs;
    const lines = capped.map(m => estimateMessageLines(m.content, m.thinking, terminalWidth, m.contentBlocks));
    const total = lines.reduce((a, b) => a + b, 0);
    const vp = Math.max(terminalHeight - UI_OVERHEAD, 5);
    return Math.max(0, total - vp);
  });

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

  const totalLines = lineOffsets[lineOffsets.length - 1] || 0;
  const maxLineOffset = Math.max(0, totalLines - viewportLines);
  const clampedLineOffset = Math.min(scrollLineOffset, maxLineOffset);
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
    showLastMsgOutside = !streamingMsg && !isAtBottom && completedMessages.length > 0;
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
  function getMaxLineOffset(): number {
    const msgs = messagesRef.current.filter(m => !m.isStreaming);
    const capped = msgs.length > MAX_HISTORY_MESSAGES ? msgs.slice(-MAX_HISTORY_MESSAGES) : msgs;
    const lines = capped.map(msg =>
      estimateMessageLines(msg.content, msg.thinking, terminalWidthRef.current, msg.contentBlocks),
    );
    const total = lines.reduce((a, b) => a + b, 0);
    return Math.max(0, total - Math.max(terminalHeightRef.current - UI_OVERHEAD, 5));
  }

  useInput((_input, key) => {
    if (key.upArrow && key.ctrl) {
      setScrollLineOffset(prev => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow && key.ctrl) {
      setScrollLineOffset(prev => {
        const max = getMaxLineOffset();
        return Math.min(max, prev + 1);
      });
      return;
    }
    if (key.pageUp) {
      setScrollLineOffset(prev => Math.max(0, prev - viewportLines));
      return;
    }
    if (key.pageDown) {
      setScrollLineOffset(prev => {
        const max = getMaxLineOffset();
        return Math.min(max, prev + viewportLines);
      });
      return;
    }
    if (key.home) {
      setScrollLineOffset(0);
      return;
    }
    if (key.end) {
      setScrollLineOffset(getMaxLineOffset());
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

          // Report render latency to status bar
          const latency = getStreamingLatencyMs();
          if (latency > 30) {
            onRenderLatencyRef.current?.(latency);
          }
        }
      }

      // Keep polling if there's pending work
      const stillHasPending = pendingMessagesRef.current !== null;
      const stillStreaming = !!(getStreamingContent() && streaming);
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
        // Auto-scroll to bottom when a new user message or streaming message appears
        const prevLen = prevMessages.length;
        const newLen = newMessages.length;
        if (newLen > prevLen) {
          const lastNew = newMessages[newLen - 1];
          if (lastNew?.role === 'user' || lastNew?.isStreaming) {
            // User message or streaming start → jump to bottom
            const msgs = newMessages.filter(m => !m.isStreaming);
            const capped = msgs.length > MAX_HISTORY_MESSAGES ? msgs.slice(-MAX_HISTORY_MESSAGES) : msgs;
            const lines = capped.map(m => estimateMessageLines(m.content, m.thinking, terminalWidthRef.current, m.contentBlocks));
            const total = lines.reduce((a, b) => a + b, 0);
            const vp = Math.max(terminalHeightRef.current - UI_OVERHEAD, 5);
            const maxOff = Math.max(0, total - vp);
            setScrollLineOffset(maxOff);
          }
        }

        // When streaming transitions to complete, apply immediately
        const wasStreaming = prevMessages[prevMessages.length - 1]?.isStreaming ?? false;
        const nowStreaming = newMessages[newMessages.length - 1]?.isStreaming ?? false;
        if (wasStreaming && !nowStreaming) {
          pendingMessagesRef.current = null;
          setMessages([...newMessages]);
        } else {
          pendingMessagesRef.current = [...newMessages];
        }
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
      {streamingMsg && (
        <MessageRenderer
          key={streamingMsg.id}
          content={buffer ? streamingMsg.content + buffer.content : streamingMsg.content}
          role={streamingMsg.role}
          terminalWidth={terminalWidth}
          showPrefix={true}
          thinking={buffer ? (streamingMsg.thinking || '') + buffer.thinking : streamingMsg.thinking}
          isStreaming={true}
          showAllThinking={showAllThinking}
          contentBlocks={streamingMsg.contentBlocks}
        />
      )}

      {/* Last completed message pinned at bottom when scrolled up */}
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
