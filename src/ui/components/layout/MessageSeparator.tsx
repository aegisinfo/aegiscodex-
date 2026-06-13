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
    <Box marginY={0}>
      <Text color={theme.colors.border.light} dimColor>
        {'\u2500'}{'\u00B7'}{'\u2500'}
      </Text>
    </Box>
  );
});
MessageSeparator.displayName = 'MessageSeparator';

export default MessageSeparator;
