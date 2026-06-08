/**
 * MessageList - RAF-driven polling renderer
 *
 * Does NOT subscribe to per-delta store updates. Instead, uses a RAF loop
 * that polls the store directly and only calls setMessages when content
 * actually changed (by reference of the relevant streaming message).
 *
 * This avoids cascading re-renders from per-delta zustand subscription
 * callbacks (which fire on every tiny content append because the messages
 * array is always a new reference).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box } from 'ink';
import { MessageRenderer } from '../markdown/MessageRenderer.js';
import { getState, subscribeToMessages } from '../../../store/index.js';
import { vanillaStore } from '../../../store/vanilla.js';

interface MessageListProps {
  terminalWidth: number;
}

/**
 * MessageList - polls at ~60fps only when streaming is active.
 */
export const MessageList: React.FC<MessageListProps> = React.memo(({ terminalWidth }) => {
  const [messages, setMessages] = useState(() => getState().session.messages);
  const messagesRef = useRef(messages);
  const rafIdRef = useRef<number | null>(null);
  const isStreamingRef = useRef(false);
  const lastLenRef = useRef(messages.length);

  // showAllThinking from store subscription
  const [showAllThinking, setShowAllThinking] = useState(() => vanillaStore.getState().app.showAllThinking);
  useEffect(() => {
    const unsub = vanillaStore.subscribe((state) => {
      const val = state.app.showAllThinking;
      setShowAllThinking(prev => prev !== val ? val : prev);
    });
    return unsub;
  }, []);

  // Lightweight subscription: only detect START/END of streaming and message count changes.
  // Actual streaming content is polled via RAF (below).
  useEffect(() => {
    const unsub = subscribeToMessages((newMessages) => {
      const len = newMessages.length;

      // New message was added (user/assistant) — update immediately
      if (len !== lastLenRef.current) {
        lastLenRef.current = len;
        messagesRef.current = newMessages;
        setMessages(newMessages);
        return;
      }

      // Check if streaming just started or stopped
      const hasStreaming = newMessages.some(m => m.isStreaming);
      if (hasStreaming !== isStreamingRef.current) {
        isStreamingRef.current = hasStreaming;
        if (hasStreaming) {
          startRafLoop();
        } else {
          stopRafLoop();
          // Final flush: grab latest content
          const final = getState().session.messages;
          messagesRef.current = final;
          setMessages(final);
        }
      }
    });

    return () => {
      unsub();
      stopRafLoop();
    };
  }, []);

  const startRafLoop = useCallback(() => {
    if (rafIdRef.current !== null) return;

    const poll = () => {
      if (!isStreamingRef.current) {
        rafIdRef.current = null;
        return;
      }

      const current = getState().session.messages;
      const prev = messagesRef.current;

      // Only update if something actually changed (by ref)
      let changed = false;
      if (current.length !== prev.length) {
        changed = true;
      } else {
        for (let i = 0; i < current.length; i++) {
          if (current[i] !== prev[i]) {
            changed = true;
            break;
          }
        }
      }

      if (changed) {
        messagesRef.current = current;
        setMessages(current);
      }

      rafIdRef.current = requestAnimationFrame(poll);
    };

    rafIdRef.current = requestAnimationFrame(poll);
  }, []);

  const stopRafLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopRafLoop();
  }, [stopRafLoop]);

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
