/**
 * MessageList - renders messages with RAF-throttled streaming content.
 *
 * Fullscreen mode (alt buffer): all messages are rendered inside the app.
 * Uses windowed rendering: only messages within the visible viewport are
 * rendered, with PgUp/PgDn scrolling support.
 *
 * Why bypass the store for streaming content?
 *   vanillaStore.setState() triggers the subscription on every delta, forcing
 *   full Ink reconciliation and a visible terminal "blink" at every tick.
 *   The RAF loop polls the mutable buffer directly and only bumps a LOCAL
 *   counter (streamingVersion) — only MessageList re-renders, nothing else.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { MessageRenderer } from '../markdown/MessageRenderer.js';
import { getState } from '../../../store/index.js';
import { vanillaStore } from '../../../store/vanilla.js';
import { getStreamingContent, isActiveStreamingMessage } from '../../../store/streaming-buffer.js';

interface MessageListProps {
  terminalWidth: number;
  terminalHeight: number;
  scrollOffset: number;
  onScroll: (offset: number) => void;
}

const RAF_INTERVAL_MS = 30;   // ~33fps redraws
const CONTENT_THRESHOLD = 1;   // re-render on every content character
const THINKING_THRESHOLD = 1; // update thinking content every 1 char for real-time visibility
const UI_OVERHEAD = 6; // rows for input area, status bar, etc.
export const UI_OVERHEAD_MAIN = 8; // matches AegisInterface.tsx pageSize calc for scroll offset consistency

// How many messages fit on screen (rough estimate)
function calcVisibleCount(terminalHeight: number): number {
  const available = Math.max(terminalHeight - UI_OVERHEAD, 5);
  return Math.max(3, Math.ceil(available / 3));
}

// Consistent page size used by both AegisInterface and MessageList
export function calcPageSize(terminalHeight: number): number {
  const available = Math.max(terminalHeight - UI_OVERHEAD_MAIN, 5);
  return Math.max(3, Math.ceil(available / 3));
}

export const MessageList: React.FC<MessageListProps> = React.memo(({
  terminalWidth,
  terminalHeight,
  scrollOffset,
  onScroll,
}) => {
  const [messages, setMessages] = useState(() => getState().session.messages);
  const [showAllThinking, setShowAllThinking] = useState(() => vanillaStore.getState().app.showAllThinking);
  const [streamingVersion, setStreamingVersion] = useState(0);

  const lastContentLenRef = useRef<Record<string, { content: number; thinking: number }>>({});
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const showAllThinkingRef = useRef(showAllThinking);
  showAllThinkingRef.current = showAllThinking;
  const scrollOffsetRef = useRef(scrollOffset);
  scrollOffsetRef.current = scrollOffset;
  const terminalHeightRef = useRef(terminalHeight);
  terminalHeightRef.current = terminalHeight;
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;

  // Queued store updates — applied during the RAF tick to prevent dual-path jumping.
  const pendingMessagesRef = useRef<typeof messages | null>(null);
  // Queued scroll offset — applied in the same RAF tick as pendingMessages so
  // they land in a single React render (prevents the jump where offset changes
  // before messages update, showing old content at the new scroll position).
  const pendingScrollRef = useRef<number | null>(null);

  // Tracks whether RAF should keep polling. Starts false; activated by store subscription
  // when streaming or message changes are detected. Deactivated when idle.
  const rafActiveRef = useRef(false);
  const rafIdRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const lastRafTimeRef = useRef(0);

  // Start/restart the RAF loop. Safe to call multiple times — checks rafActiveRef.
  function ensureRafRunning() {
    if (rafActiveRef.current) return;
    rafActiveRef.current = true;

    const flushTick = (now: number) => {
      if (!rafActiveRef.current) return; // stopped while tick was queued
      if (now - lastRafTimeRef.current < RAF_INTERVAL_MS) {
        rafIdRef.current = requestAnimationFrame(flushTick);
        return;
      }
      lastRafTimeRef.current = now;

      // 1. Apply any pending store message changes (tool calls, blocks, etc.)
      // Apply scroll offset in the same tick so they land in one React render —
      // prevents a visible jump where offset advances before messages update.
      if (pendingMessagesRef.current) {
        setMessages(pendingMessagesRef.current);
        pendingMessagesRef.current = null;
        if (pendingScrollRef.current !== null) {
          onScrollRef.current(pendingScrollRef.current);
          pendingScrollRef.current = null;
        }
      } else if (pendingScrollRef.current !== null) {
        onScrollRef.current(pendingScrollRef.current);
        pendingScrollRef.current = null;
      }

      // 2. Check and apply buffered streaming content
      const buffer = getStreamingContent();
      const state = vanillaStore.getState();
      const streamingMsg = state.session.messages.find(m => m.isStreaming && isActiveStreamingMessage(m));

      if (buffer && streamingMsg) {
        const lastLen = lastContentLenRef.current[streamingMsg.id] || { content: 0, thinking: 0 };

        if (lastLen.content > buffer.content.length || lastLen.thinking > buffer.thinking.length) {
          lastContentLenRef.current[streamingMsg.id] = { content: 0, thinking: 0 };
        }

        const updatedLastLen = lastContentLenRef.current[streamingMsg.id] || { content: 0, thinking: 0 };
        const deltaContent = buffer.content.length - updatedLastLen.content;
        const deltaThinking = buffer.thinking.length - updatedLastLen.thinking;
        const thinkingJustStarted = updatedLastLen.thinking === 0 && buffer.thinking.length > 0;

        if (deltaContent >= CONTENT_THRESHOLD || deltaThinking >= THINKING_THRESHOLD || thinkingJustStarted) {
          lastContentLenRef.current[streamingMsg.id] = {
            content: buffer.content.length,
            thinking: buffer.thinking.length,
          };
          setStreamingVersion(v => v + 1);
        }
      }

      // If there's pending messages or active streaming, keep polling.
      // Otherwise stop to save CPU and reduce unnecessary terminal flushes.
      const stillHasPending = pendingMessagesRef.current !== null;
      const stillStreaming = !!(getStreamingContent() && streamingMsg);
      if (stillHasPending || stillStreaming) {
        rafIdRef.current = requestAnimationFrame(flushTick);
      } else {
        rafActiveRef.current = false;
        rafIdRef.current = null;
      }
    };

    rafIdRef.current = requestAnimationFrame(flushTick);
  }

  useEffect(() => {
    const unsub = vanillaStore.subscribe((state) => {
      const newMessages = state.session.messages;
      const newShowAllThinking = state.app.showAllThinking;
      const prevMessages = messagesRef.current;

      let messagesChanged = false;
      if (newMessages.length !== prevMessages.length) {
        messagesChanged = true;
        // Queue scroll alongside message update — flushed in the same RAF tick
        // so they land in one React render and don't cause a visible position jump.
        const visibleCount = calcVisibleCount(terminalHeightRef.current);
        const maxOffset = Math.max(0, newMessages.length - visibleCount);
        if (scrollOffsetRef.current >= maxOffset - 1) {
          pendingScrollRef.current = maxOffset;
        }
      } else if (newMessages[newMessages.length - 1]?.isStreaming) {
        const visibleCount = calcVisibleCount(terminalHeightRef.current);
        const maxOffset = Math.max(0, newMessages.length - visibleCount);
        if (scrollOffsetRef.current >= maxOffset - 1) {
          pendingScrollRef.current = maxOffset;
        }
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
        // When streaming transitions to complete, apply immediately — no more buffer
        // interleaving risk, and the cursor/thinking must vanish without delay.
        const wasStreaming = prevMessages[prevMessages.length - 1]?.isStreaming ?? false;
        const nowStreaming = newMessages[newMessages.length - 1]?.isStreaming ?? false;
        if (wasStreaming && !nowStreaming) {
          pendingMessagesRef.current = null;
          setMessages([...newMessages]);
        } else {
          pendingMessagesRef.current = [...newMessages];
        }
        // Ensure RAF loop is running to pick up pending messages
        ensureRafRunning();
      }

      // Start RAF loop if a new streaming message appeared
      if (newMessages.length > 0 && newMessages[newMessages.length - 1].isStreaming) {
        ensureRafRunning();
      }

      // showAllThinking is not streaming-related, safe to apply immediately.
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

  const completedMessages = messages.filter(msg => !msg.isStreaming);
  const streamingMsg = messages.find(msg => msg.isStreaming && isActiveStreamingMessage(msg));
  const buffer = streamingMsg ? getStreamingContent() : null;

  const visibleCount = calcVisibleCount(terminalHeight);
  // Apply windowing only when there are more messages than fit on screen.
  // Below that threshold, render everything directly to avoid padding jitter.
  const useWindowing = completedMessages.length > visibleCount;
  const maxOffset = Math.max(0, messages.length - visibleCount);
  const clampedOffset = Math.min(scrollOffset, maxOffset);
  const isAtBottom = clampedOffset >= maxOffset;

  let visibleMessages = completedMessages;
  let showLastMsgOutside = false;

  if (useWindowing) {
    const windowStart = clampedOffset;
    const windowEnd = Math.min(clampedOffset + visibleCount, completedMessages.length);
    visibleMessages = completedMessages.slice(windowStart, windowEnd);
    // No padding — padding boxes push content off-screen in Ink's layout model.
    // The windowed slice always renders at the top of the available area.
    showLastMsgOutside = !streamingMsg && !isAtBottom && completedMessages.length > 0;
  }

  return (
    <Box flexDirection="column">
      {/* Scroll-up indicator */}
      {useWindowing && !isAtBottom && !streamingMsg && (
        <Box>
          <Text dimColor>↑ scrolled ({completedMessages.length - clampedOffset - visibleCount} more above) — End or Ctrl+Down to return</Text>
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
