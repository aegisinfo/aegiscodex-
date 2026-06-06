/**
 * 
 * 
 */

import React from 'react';
import { Box, Text } from 'ink';
import { MessageRenderer } from '../markdown/MessageRenderer.js';
import { useTerminalWidth } from '../../hooks/index.js';
import { themeManager } from '../../themes/index.js';

/**
 */
export interface UIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: number;
  metadata?: {
    model?: string;
    tokenUsage?: { input: number; output: number };
  };
}

interface MessageAreaProps {
  
  messages: UIMessage[];
  
  maxMessages?: number;
  
  showTimestamp?: boolean;
}

/**
 * 
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 
 */
export const MessageArea: React.FC<MessageAreaProps> = ({
  messages,
  maxMessages = 50,
  showTimestamp = false,
}) => {
  const terminalWidth = useTerminalWidth();
  const theme = themeManager.getTheme();
  const displayMessages = messages.slice(-maxMessages);

  if (displayMessages.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={theme.colors.text.muted} dimColor>
          No messages yet. Start a conversation!
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {displayMessages.map((message, index) => (
        <Box key={index} flexDirection="column" marginBottom={1}>
          {}
          {showTimestamp && message.timestamp && (
            <Box marginBottom={0}>
              <Text color={theme.colors.text.muted} dimColor>
                {formatTimestamp(message.timestamp)}
              </Text>
            </Box>
          )}
          
          {}
          <MessageRenderer
            content={message.content}
            role={message.role}
            terminalWidth={terminalWidth - 2}
            showPrefix={true}
          />
        </Box>
      ))}
    </Box>
  );
};

export default MessageArea;
