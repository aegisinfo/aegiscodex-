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
import { getStreamingContent, resetConsumerPosition, isActiveStreamingMessage } from '../../../store/streaming-buffer.js';

interface MessageListProps {
  terminalWidth: number;
  terminalHeight: number;
  scrollOffset: number;
  onScroll: (offset: number) => void;
}

const RAF_INTERVAL_MS = 500;  // 2fps redraws — reduces terminal blink significantly
const CONTENT_THRESHOLD = 15; // batch more chars before triggering repaint
const ESTIMATED_ITEM_HEIGHT = 3; // rows per message average
const UI_OVERHEAD = 6; // rows for input area, status bar, etc.

// How many messages fit on screen (rough estimate)
function calcVisibleCount(terminalHeight: number): number {
  const available = Math.max(terminalHeight - UI_OVERHEAD, 5);
  return Math.max(3, Math.ceil(available / ESTIMATED_ITEM_HEIGHT));
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
      // Collated update: apply both buffered streaming content AND any
      // pending store messages in a SINGLE render cycle. This prevents
      // the "jumping" caused by store subscription updates (tool calls,
      // block additions) interleaving with RAF streaming content updates.
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

        if (deltaContent >= CONTENT_THRESHOLD || deltaThinking >= CONTENT_THRESHOLD) {
          lastContentLenRef.current[streamingMsg.id] = {
            content: buffer.content.length,
            thinking: buffer.thinking.length,
          };
          resetConsumerPosition();
          setStreamingVersion(v => v + 1);
        }
      }

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

      // Don't call setMessages directly — queue for the RAF tick instead.
      // This prevents dual-path interleaving with the streaming buffer updates.
      if (messagesChanged) {
        pendingMessagesRef.current = [...newMessages];
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

  // Skip windowed rendering when there are few messages (common during streaming).
  // Estimated-height padding causes vertical jitter — render everything directly
  // since the message count is small enough to fit on screen.
  const totalMessages = completedMessages.length + (streamingMsg ? 1 : 0);
  const useWindowing = totalMessages > 20;

  const visibleCount = calcVisibleCount(terminalHeight);
  const maxOffset = Math.max(0, messages.length - visibleCount);
  const clampedOffset = Math.min(scrollOffset, maxOffset);
  const isAtBottom = clampedOffset >= maxOffset;

  let topPaddingEl = null;
  let bottomPaddingEl = null;
  let visibleMessages = completedMessages;
  let showLastMsgOutside = false;

  if (useWindowing) {
    const windowStart = clampedOffset;
    const windowEnd = Math.min(clampedOffset + visibleCount, completedMessages.length);
    visibleMessages = completedMessages.slice(windowStart, windowEnd);
    const topPaddingLines = windowStart * ESTIMATED_ITEM_HEIGHT;
    const bottomPaddingLines = (completedMessages.length - windowEnd) * ESTIMATED_ITEM_HEIGHT;
    if (topPaddingLines > 0) {
      topPaddingEl = <Box height={Math.min(topPaddingLines, terminalHeight - 3)} />;
    }
    if (bottomPaddingLines > 0) {
      bottomPaddingEl = <Box height={Math.min(bottomPaddingLines, terminalHeight - 3)} />;
    }
    showLastMsgOutside = !streamingMsg && !isAtBottom && completedMessages.length > 0;
  }

  return (
    <Box flexDirection="column">
      {topPaddingEl}

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

      {/* Last completed message (pinned at bottom when scrolled up and no streaming) */}
      {showLastMsgOutside && (
        <MessageRenderer
          key={completedMessages[completedMessages.length - 1].id}
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

      {bottomPaddingEl}
    </Box>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;
