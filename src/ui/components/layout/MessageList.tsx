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
import { Box } from 'ink';
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
const THINKING_THRESHOLD = 200; // only update word count every 200 thinking chars
const UI_OVERHEAD = 6; // rows for input area, status bar, etc.

// How many messages fit on screen (rough estimate)
function calcVisibleCount(terminalHeight: number): number {
  const available = Math.max(terminalHeight - UI_OVERHEAD, 5);
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

  useEffect(() => {
    let rafId: ReturnType<typeof requestAnimationFrame> | null = null;
    let lastRafTime = 0;

    const flushTick = (now: number) => {
      if (now - lastRafTime < RAF_INTERVAL_MS) {
        rafId = requestAnimationFrame(flushTick);
        return;
      }
      lastRafTime = now;

      // 1. Apply any pending store message changes (tool calls, blocks, etc.)
      if (pendingMessagesRef.current) {
        setMessages(pendingMessagesRef.current);
        pendingMessagesRef.current = null;
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

        if (deltaContent >= CONTENT_THRESHOLD || deltaThinking >= THINKING_THRESHOLD) {
          lastContentLenRef.current[streamingMsg.id] = {
            content: buffer.content.length,
            thinking: buffer.thinking.length,
          };
          setStreamingVersion(v => v + 1);
        }
      }

      // Always keep ticking — no restart latency when streaming begins.
      rafId = requestAnimationFrame(flushTick);
    };

    rafId = requestAnimationFrame(flushTick);

    const unsub = vanillaStore.subscribe((state) => {
      const newMessages = state.session.messages;
      const newShowAllThinking = state.app.showAllThinking;
      const prevMessages = messagesRef.current;

      let messagesChanged = false;
      if (newMessages.length !== prevMessages.length) {
        messagesChanged = true;
        // Auto-scroll to bottom when new messages arrive (if currently at bottom)
        const visibleCount = calcVisibleCount(terminalHeightRef.current);
        const maxOffset = Math.max(0, newMessages.length - visibleCount);
        if (scrollOffsetRef.current >= maxOffset) {
          onScrollRef.current(maxOffset);
        }
      } else if (newMessages[newMessages.length - 1]?.isStreaming) {
        // Also auto-scroll during streaming content growth (message count unchanged,
        // but content appended). Without this, scrolling freezes once user is "at bottom"
        // during a /multi or any streaming response that uses onContentDelta.
        const visibleCount = calcVisibleCount(terminalHeightRef.current);
        const maxOffset = Math.max(0, newMessages.length - visibleCount);
        if (scrollOffsetRef.current >= maxOffset) {
          onScrollRef.current(maxOffset);
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
      if (rafId !== null) cancelAnimationFrame(rafId);
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
