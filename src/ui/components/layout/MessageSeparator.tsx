/**
 * MessageSeparator - visual divider between messages
 */

import React from 'react';
import { Box, Text } from 'ink';
import { themeManager } from '../../themes/index.js';

interface MessageSeparatorProps {
  isLast: boolean;
}

export const MessageSeparator: React.FC<MessageSeparatorProps> = React.memo(({ isLast }) => {
  if (isLast) return null;
  const theme = themeManager.getTheme();
  return (
    <Box marginY={1} paddingLeft={1}>
      <Text color={theme.colors.text.muted} dimColor>
        {'\u254C\u254C\u254C\u254C\u254C\u254C\u254C\u254C\u254C\u254C\u254C\u254C\u254C\u254C\u254C\u254C\u254C\u254C\u254C\u254C\u254C\u254C\u254C\u254C'}
      </Text>
    </Box>
  );
});
MessageSeparator.displayName = 'MessageSeparator';

export default MessageSeparator;
