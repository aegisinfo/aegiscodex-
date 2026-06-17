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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { MessageRenderer } from '../markdown/MessageRenderer.js';
import { getState } from '../../../store/index.js';
import { vanillaStore } from '../../../store/vanilla.js';
import { getStreamingContent, isActiveStreamingMessage } from '../../../store/streaming-buffer.js';
import { themeManager } from '../../themes/index.js';

interface MessageListProps {
  terminalWidth: number;
  terminalHeight: number;
  /** Called when scroll state changes (for status bar indicator) */
  onScrolledUpChange?: (isScrolledUp: boolean) => void;
}

const RAF_INTERVAL_MS = 30;   // ~33fps redraws
const CONTENT_THRESHOLD = 1;   // re-render on every content character
const THINKING_THRESHOLD = 1; // update thinking content every 1 char for real-time visibility
const UI_OVERHEAD = 6; // rows for input area, status bar, etc.

// How many messages fit on screen (rough estimate)
function calcVisibleCount(terminalHeight: number): number {
  const available = Math.max(terminalHeight - UI_OVERHEAD, 5);
  return Math.max(3, Math.ceil(available / 3));
}

export function calcPageSize(terminalHeight: number): number {
  return calcVisibleCount(terminalHeight);
}

export const MessageList: React.FC<MessageListProps> = React.memo(({
  terminalWidth,
  terminalHeight,
  onScrolledUpChange,
}) => {
  // ==================== Internal Scroll State ====================
  const [messages, setMessages] = useState(() => getState().session.messages);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [showAllThinking, setShowAllThinking] = useState(() => vanillaStore.getState().app.showAllThinking);
  const [streamingVersion, setStreamingVersion] = useState(0);

  // Refs for values used in callbacks/RAF
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const scrollOffsetRef = useRef(scrollOffset);
  scrollOffsetRef.current = scrollOffset;
  const showAllThinkingRef = useRef(showAllThinking);
  showAllThinkingRef.current = showAllThinking;
  const terminalHeightRef = useRef(terminalHeight);
  terminalHeightRef.current = terminalHeight;
  const onScrolledUpChangeRef = useRef(onScrolledUpChange);
  onScrolledUpChangeRef.current = onScrolledUpChange;

  // ==================== Computed values ====================
  const pageSize = calcVisibleCount(terminalHeight);
  const completedMessages = messages.filter(msg => !msg.isStreaming);
  const streamingMsg = messages.find(msg => msg.isStreaming && isActiveStreamingMessage(msg));
  const buffer = streamingMsg ? getStreamingContent() : null;

  const useWindowing = completedMessages.length > pageSize;
  const maxOffset = Math.max(0, messages.length - pageSize);
  const clampedOffset = Math.min(scrollOffset, maxOffset);
  const isAtBottom = clampedOffset >= maxOffset;

  // Clamp scrollOffset when terminal height or message count changes
  // Prevents out-of-bounds after resize or new message arrival
  useEffect(() => {
    setScrollOffset(prev => Math.min(prev, Math.max(0, messages.length - pageSize)));
  }, [pageSize, messages.length]);

  let visibleMessages = completedMessages;
  let showLastMsgOutside = false;

  if (useWindowing) {
    const windowStart = clampedOffset;
    const windowEnd = Math.min(clampedOffset + pageSize, completedMessages.length);
    visibleMessages = completedMessages.slice(windowStart, windowEnd);
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
  useInput((_input, key) => {
    if (key.upArrow && key.ctrl) {
      setScrollOffset(prev => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow && key.ctrl) {
      setScrollOffset(prev => {
        const max = Math.max(0, messagesRef.current.length - pageSize);
        return Math.min(max, prev + 1);
      });
      return;
    }
    if (key.pageUp) {
      setScrollOffset(prev => Math.max(0, prev - pageSize));
      return;
    }
    if (key.pageDown) {
      setScrollOffset(prev => {
        const max = Math.max(0, messagesRef.current.length - pageSize);
        return Math.min(max, prev + pageSize);
      });
      return;
    }
    if (key.home) {
      setScrollOffset(0);
      return;
    }
    if (key.end) {
      setScrollOffset(Math.max(0, messagesRef.current.length - pageSize));
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
      {/* Scroll-up indicator */}
      {useWindowing && !isAtBottom && !streamingMsg && (
        <Box>
          <Text color={themeManager.getTheme().colors.text.muted} dimColor>↑ {completedMessages.length - clampedOffset - pageSize} more above</Text>
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
