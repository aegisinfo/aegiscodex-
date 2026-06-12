/**
 * MessageList — renders messages with RAF-throttled streaming content.
 *
 * KEY DESIGN: Committed messages go into Ink's <Static> component, which
 * permanently writes them to the terminal scrollback buffer. The terminal
 * handles scrolling those natively — no Ink re-renders needed.
 *
 * Only the active streaming message lives in the dynamic render area.
 * RAF ticks only touch that one message, not the whole conversation history.
 *
 * This eliminates:
 *   - Full message-tree re-renders every 200ms during streaming
 *   - Ink writing large escape-code regions that fight with terminal scroll
 *   - Visible "blink" artifacts from Ink repaints
 *
 * Streaming content still bypasses the zustand store (see streaming-buffer.ts).
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

const RAF_INTERVAL_MS = 200; // ~5fps — fewer repaints = less blink
const CONTENT_THRESHOLD = 5; // min chars before triggering re-render

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
          if (
            a.id !== b.id ||
            a.isStreaming !== b.isStreaming ||
            a.content !== b.content ||
            a.thinking !== b.thinking ||
            a.contentBlocks !== b.contentBlocks
          ) {
            messagesChanged = true;
            break;
          }
        }
      }

      if (messagesChanged) {
        setMessages([...newMessages]);
      }
      if (newShowAllThinking !== showAllThinkingRef.current) {
        setShowAllThinking(newShowAllThinking);
      }

      newMessages.forEach(msg => {
        if (!msg.isStreaming) {
          delete lastContentLenRef.current[msg.id];
        }
      });
    });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Split messages: committed go to Static (terminal scrollback, rendered once)
  // active streaming message stays in the live Ink render area
  const committedMessages = messages.filter(m => !m.isStreaming);
  const streamingMsg = messages.find(m => m.isStreaming && isActiveStreamingMessage(m));
  const buffer = streamingMsg ? getStreamingContent() : null;

  return (
    <Box flexDirection="column">
      {/* Committed messages — rendered once into terminal scrollback.
          Terminal handles scroll natively; Ink never re-renders these. */}
      <Static items={committedMessages}>
        {(msg) => (
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
        )}
      </Static>

      {/* Active streaming message — RAF loop bumps streamingVersion to update this */}
      {streamingMsg && (
        <MessageRenderer
          key={streamingMsg.id}
          content={streamingMsg.content + (buffer?.content ?? '')}
          role={streamingMsg.role}
          terminalWidth={terminalWidth}
          showPrefix={true}
          thinking={(streamingMsg.thinking ?? '') + (buffer?.thinking ?? '')}
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
