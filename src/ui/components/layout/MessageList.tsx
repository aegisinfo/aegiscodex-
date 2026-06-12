/**
 * MessageList — renders messages directly in Ink's layout (no Static).
 *
 * Layout model: AegisInterface wraps everything in a fixed height={terminalHeight}
 * box. A flexGrow spacer above MessageList pushes content to the bottom.
 * This gives two screens:
 *   - Start (0 messages): WelcomeMessage fills space above input
 *   - Chat: spacer fills space above messages; messages + input pin to bottom
 *
 * Streaming: a 100ms interval polls the mutable buffer and updates streamContent
 * state, re-rendering the active streaming message inline.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text } from 'ink';
import { MessageRenderer } from '../markdown/MessageRenderer.js';
import { getState } from '../../../store/index.js';
import { vanillaStore } from '../../../store/vanilla.js';
import { getStreamingContent, isActiveStreamingMessage } from '../../../store/streaming-buffer.js';
import { themeManager } from '../../themes/index.js';

interface MessageListProps {
  terminalWidth: number;
  terminalHeight?: number;
}

// Animated ✻ spinner for the streaming indicator
const STAR_FRAMES = ['✻', '✼', '✽', '✾', '✽', '✼'];
const STAR_INTERVAL = 150;

const AsterixSpinner: React.FC<{ color: string }> = React.memo(({ color }) => {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % STAR_FRAMES.length), STAR_INTERVAL);
    return () => clearInterval(id);
  }, []);
  return <Text color={color}>{STAR_FRAMES[frame]}</Text>;
});
AsterixSpinner.displayName = 'AsterixSpinner';

export const MessageList: React.FC<MessageListProps> = React.memo(({ terminalWidth, terminalHeight = 24 }) => {
  const [messages, setMessages] = useState(() => getState().session.messages);
  const [showAllThinking, setShowAllThinking] = useState(() => vanillaStore.getState().app.showAllThinking);
  const [streamContent, setStreamContent] = useState('');

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Subscribe to store changes
  useEffect(() => {
    const unsub = vanillaStore.subscribe((state) => {
      const newMessages = state.session.messages;
      const newShowAllThinking = state.app.showAllThinking;

      // Shallow diff to avoid unnecessary re-renders
      const prev = messagesRef.current;
      let changed = newMessages.length !== prev.length;
      if (!changed) {
        for (let i = 0; i < newMessages.length; i++) {
          const a = prev[i], b = newMessages[i];
          if (a.id !== b.id || a.isStreaming !== b.isStreaming ||
              a.content !== b.content || a.thinking !== b.thinking ||
              a.contentBlocks !== b.contentBlocks) {
            changed = true; break;
          }
        }
      }
      if (changed) setMessages([...newMessages]);
      if (newShowAllThinking !== showAllThinking) setShowAllThinking(newShowAllThinking);
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll streaming buffer at 100ms for live content updates
  useEffect(() => {
    const id = setInterval(() => {
      const buf = getStreamingContent();
      setStreamContent(buf ? buf.content : '');
    }, 100);
    return () => clearInterval(id);
  }, []);

  const theme = themeManager.getTheme();

  const completedMessages = messages.filter(m => !m.isStreaming);
  const streamingMsg = messages.find(m => m.isStreaming && isActiveStreamingMessage(m));

  // Limit visible messages to avoid overflowing the fixed-height box.
  // Rough estimate: each message averages ~3 rows + 1 separator.
  // Reserve ~6 rows for input+status+streaming indicator.
  const maxVisible = Math.max(3, Math.floor((terminalHeight - 6) / 4));
  const visibleMessages = completedMessages.slice(-maxVisible);

  return (
    <Box flexDirection="column">
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

      {/* Active streaming message */}
      {streamingMsg && (
        <Box flexDirection="column">
          {streamContent.trim() && (
            <Box marginLeft={2} marginBottom={0}>
              <Text color={theme.colors.text.primary}>{streamContent}</Text>
            </Box>
          )}
          <Box marginLeft={2} marginBottom={0}>
            <AsterixSpinner color={theme.colors.primary} />
            <Text color={theme.colors.text.muted} dimColor>
              {`  generating${streamContent.length > 0 ? `  ${streamContent.length.toLocaleString()} chars` : ''}`}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
});

MessageList.displayName = 'MessageList';
export default MessageList;
