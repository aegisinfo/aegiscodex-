/**
 * MessageList - RAF-throttled store subscriber.
 *
 * During streaming, content deltas go ONLY to the mutable streaming buffer
 * (see sessionSlice.ts). This component uses a requestAnimationFrame loop
 * to periodically sync buffer content into the store and trigger Ink
 * re-renders at a capped rate (~30fps), avoiding cascading re-renders
 * on every individual token delta.
 *
 * For non-streaming updates (new messages, tool calls), the store
 * subscription handles them immediately.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box } from 'ink';
import { MessageRenderer } from '../markdown/MessageRenderer.js';
import { getState } from '../../../store/index.js';
import { vanillaStore } from '../../../store/vanilla.js';
import { getStreamingContent, getConsumerPosition, resetConsumerPosition, isActiveStreamingMessage } from '../../../store/streaming-buffer.js';
import type { SessionMessage } from '../../../store/types.js';

interface MessageListProps {
  terminalWidth: number;
}

const RAF_INTERVAL_MS = 50; // ~20fps — balances responsiveness and render cost

export const MessageList: React.FC<MessageListProps> = React.memo(({ terminalWidth }) => {
  const [messages, setMessages] = useState(() => getState().session.messages);
  const [showAllThinking, setShowAllThinking] = useState(() => vanillaStore.getState().app.showAllThinking);

  // Track last-seen content length per streaming message to avoid dupes
  const lastContentLenRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let rafId: ReturnType<typeof requestAnimationFrame> | null = null;
    let lastRafTime = 0;

    /**
     * RAF loop: during active streaming, poll the buffer and sync to store.
     * This is the ONLY place buffer content gets applied to the store.
     * Individual token deltas (appendToStreamingMessage) write only to the buffer.
     */
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
        const lastLen = lastContentLenRef.current[streamingMsg.id] || 0;
        const newContent = buffer.content.slice(lastLen);
        const newThinking = buffer.thinking.slice(lastLen);

        if (newContent || newThinking) {
          vanillaStore.setState((s: any) => ({
            session: {
              ...s.session,
              messages: s.session.messages.map((msg: SessionMessage) =>
                msg.id === streamingMsg.id
                  ? {
                      ...msg,
                      content: newContent ? msg.content + newContent : msg.content,
                      thinking: newThinking ? (msg.thinking || '') + newThinking : msg.thinking,
                    }
                  : msg
              ),
            },
          }));
          lastContentLenRef.current[streamingMsg.id] = buffer.content.length;
        }
      }

      rafId = requestAnimationFrame(pollBuffer);
    };

    // Start RAF loop
    rafId = requestAnimationFrame(pollBuffer);

    // Store subscription for non-streaming updates (new messages, etc.)
    const unsub = vanillaStore.subscribe((state) => {
      setMessages([...state.session.messages]);
      setShowAllThinking(state.app.showAllThinking);

      // Clean up content length tracking for finished messages
      state.session.messages.forEach(msg => {
        if (!msg.isStreaming) {
          delete lastContentLenRef.current[msg.id];
        }
      });
    });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      unsub();
    };
  }, []);

  return (
    <Box flexDirection="column">
      {messages.map((msg, index) => (
        <MessageRenderer
          key={msg.id || index}
          content={msg.content}
          role={msg.role}
          terminalWidth={terminalWidth}
          showPrefix={true}
          thinking={msg.thinking}
          isStreaming={msg.isStreaming}
          showAllThinking={showAllThinking}
        />
      ))}
    </Box>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;
