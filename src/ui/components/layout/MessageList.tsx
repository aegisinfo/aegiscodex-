/**
 * MessageList - Optimized diff-based rendering
 *
 * Uses shallow identity checking and a message-length-based heuristic
 * to skip intermediate re-renders during streaming.
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
 * MessageList - only re-renders when messages array identity changes
 * (via subscribeToMessages deep equality check).
 */
export const MessageList: React.FC<MessageListProps> = React.memo(({ terminalWidth }) => {
  // Fetch messages with RAF throttling to prevent per-delta re-renders
  const [messages, setMessages] = useState(() => getState().session.messages);
  const rafIdRef = useRef<number | null>(null);
  const lastLenRef = useRef(messages.length);

  // showAllThinking stored in ref + force update state to avoid hook inside MessageRenderer
  const [showAllThinking, setShowAllThinking] = useState(() => vanillaStore.getState().app.showAllThinking);
  useEffect(() => {
    const unsub = vanillaStore.subscribe((state) => {
      const val = state.app.showAllThinking;
      setShowAllThinking(prev => prev !== val ? val : prev);
    });
    return unsub;
  }, []);

  // Stable callback to prevent re-subscription on every render
  const handleMessagesChanged = useCallback((newMessages: typeof messages) => {
    const len = newMessages.length;
    if (len !== lastLenRef.current) {
      lastLenRef.current = len;
      setMessages(newMessages);
      return;
    }
    // Streaming delta - throttle via RAF to avoid per-delta React batching storms
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        // Read fresh state inside RAF callback to avoid stale closures
        setMessages(getState().session.messages);
        rafIdRef.current = null;
      });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToMessages(handleMessagesChanged);

    return () => {
      unsubscribe();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [handleMessagesChanged]);

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
