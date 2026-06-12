/**
 * MessageList - renders messages with RAF-throttled streaming content.
 *
 * Completed messages go into Ink's <Static> (terminal scrollback, rendered once).
 * The active streaming message stays in the dynamic area so it updates live.
 * Input area is always visible at the bottom of the terminal.
 *
 * Why bypass the store for streaming content?
 *   vanillaStore.setState() triggers the subscription on every delta, forcing
 *   full Ink reconciliation and a visible terminal "blink" at every tick.
 *   The RAF loop polls the mutable buffer directly and only bumps a LOCAL
 *   counter (streamingVersion) — only MessageList re-renders, nothing else.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, Static } from 'ink';
import { MessageRenderer } from '../markdown/MessageRenderer.js';
import { getState } from '../../../store/index.js';
import { vanillaStore } from '../../../store/vanilla.js';
import { getStreamingContent, resetConsumerPosition, isActiveStreamingMessage } from '../../../store/streaming-buffer.js';

interface MessageListProps {
  terminalWidth: number;
}

const RAF_INTERVAL_MS = 200;
const CONTENT_THRESHOLD = 5;

export const MessageList: React.FC<MessageListProps> = React.memo(({ terminalWidth }) => {
  const [messages, setMessages] = useState(() => getState().session.messages);
  const [showAllThinking, setShowAllThinking] = useState(() => vanillaStore.getState().app.showAllThinking);
  const [streamingVersion, setStreamingVersion] = useState(0);

  const lastContentLenRef = useRef<Record<string, { content: number; thinking: number }>>({});
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const showAllThinkingRef = useRef(showAllThinking);
  showAllThinkingRef.current = showAllThinking;

  useEffect(() => {
    let rafId: ReturnType<typeof requestAnimationFrame> | null = null;
    let lastRafTime = 0;

    const pollBuffer = (now: number) => {
      if (now - lastRafTime < RAF_INTERVAL_MS) {
        rafId = requestAnimationFrame(pollBuffer);
        return;
      }
      lastRafTime = now;

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

      rafId = requestAnimationFrame(pollBuffer);
    };

    rafId = requestAnimationFrame(pollBuffer);

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

      if (messagesChanged) setMessages([...newMessages]);
      if (newShowAllThinking !== showAllThinkingRef.current) setShowAllThinking(newShowAllThinking);

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

  // Layout strategy:
  //   Old completed messages → Static (terminal scrollback, rendered once)
  //   Last completed message → dynamic area (always visible, especially for slash cmd results)
  //   Active streaming message → dynamic area (live updates)
  //
  // Keeping the most-recent completed message dynamic ensures slash command results
  // (like /multi) are visible immediately — Static goes to scrollback which the
  // terminal viewport skips past when scrolling to show the cursor.
  const completedMessages = messages.filter(msg => !msg.isStreaming);
  const streamingMsg = messages.find(msg => msg.isStreaming && isActiveStreamingMessage(msg));
  const buffer = streamingMsg ? getStreamingContent() : null;

  const staticMessages = completedMessages.slice(0, -1);
  const lastCompleted = completedMessages.at(-1);

  return (
    <Box flexDirection="column">
      <Static items={staticMessages}>
        {(msg, index) => (
          <MessageRenderer
            key={msg.id || index}
            content={msg.content}
            role={msg.role}
            terminalWidth={terminalWidth}
            showPrefix={true}
            thinking={msg.thinking}
            isStreaming={false}
            showAllThinking={showAllThinking}
            contentBlocks={msg.contentBlocks}
          />
        )}
      </Static>

      {lastCompleted && (
        <MessageRenderer
          key={lastCompleted.id}
          content={lastCompleted.content}
          role={lastCompleted.role}
          terminalWidth={terminalWidth}
          showPrefix={true}
          thinking={lastCompleted.thinking}
          isStreaming={false}
          showAllThinking={showAllThinking}
          contentBlocks={lastCompleted.contentBlocks}
        />
      )}

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
    </Box>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;
