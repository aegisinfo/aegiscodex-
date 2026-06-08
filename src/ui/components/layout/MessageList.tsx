/**
 * MessageList - Virtualized message rendering with separators (A)
 *
 * Uses useWindowedList to only render visible messages + overscan,
 * drastically reducing render cost for long sessions.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { MessageRenderer } from '../markdown/MessageRenderer.js';
import { getState, subscribeToMessages } from '../../../store/index.js';
import { vanillaStore } from '../../../store/vanilla.js';
import { themeManager } from '../../themes/index.js';
import { useWindowedList } from '../../hooks/useWindowedList.js';
import { useTerminalHeight } from '../../hooks/useTerminalWidth.js';
import { MessageSeparator } from './MessageSeparator.js';
import { WelcomeMessage } from './WelcomeMessage.js';

interface MessageListProps {
  terminalWidth: number;
}

/**
 * MessageList - Virtualized with RAF throttled subscription (A)
 */
export const MessageList: React.FC<MessageListProps> = React.memo(({ terminalWidth }) => {
  const [messages, setMessages] = useState(() => getState().session.messages);
  const rafIdRef = useRef<number | null>(null);
  const lastLenRef = useRef(messages.length);

  // showAllThinking sync
  const [showAllThinking, setShowAllThinking] = useState(() => vanillaStore.getState().app.showAllThinking);
  useEffect(() => {
    const unsub = vanillaStore.subscribe((state) => {
      const val = state.app.showAllThinking;
      setShowAllThinking(prev => prev !== val ? val : prev);
    });
    return unsub;
  }, []);

  // RAF-throttled subscription
  useEffect(() => {
    const unsubscribe = subscribeToMessages((newMessages) => {
      const len = newMessages.length;
      if (len !== lastLenRef.current) {
        lastLenRef.current = len;
        setMessages(newMessages);
        return;
      }
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          setMessages(getState().session.messages);
          rafIdRef.current = null;
        });
      }
    });

    return () => {
      unsubscribe();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  // Virtualization: use actual terminal height
  const terminalHeight = useTerminalHeight();
  const { visibleItems, totalItems, scrollToBottom, isAtBottom } = useWindowedList(
    messages,
    terminalHeight,
  );

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  if (messages.length === 0) {
    return <WelcomeMessage terminalWidth={terminalWidth} />;
  }

  return (
    <Box flexDirection="column">
      {totalItems > visibleItems.length && (
        <Box marginY={0} justifyContent="center">
          <Text color={themeManager.getTheme().colors.text.muted} dimColor>
            {'\u22EE'} {messages.length - visibleItems.length} more {'\u22EE'}
          </Text>
        </Box>
      )}
      {visibleItems.map(({ item: msg, index }) => (
        <Box key={msg.id || index} flexDirection="column">
          <MessageRenderer
            content={msg.content}
            role={msg.role}
            terminalWidth={terminalWidth}
            showPrefix={true}
            thinking={msg.thinking}
            isStreaming={msg.isStreaming}
            showAllThinking={showAllThinking}
          />
          <MessageSeparator isLast={index === messages.length - 1} />
        </Box>
      ))}
    </Box>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;
