/**
 * WelcomeMessage - shown when no messages exist yet
 */

import React from 'react';
import { Box, Text } from 'ink';
import { themeManager } from '../../themes/index.js';
import pkg from '../../../../package.json' with { type: 'json' };

interface WelcomeMessageProps {
  terminalWidth: number;
}

export const WelcomeMessage: React.FC<WelcomeMessageProps> = React.memo(({ terminalWidth }) => {
  const theme = themeManager.getTheme();
  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Box marginBottom={1}>
        <Text color={theme.colors.primary} bold>{'\u250C\u2500\u2500'} AEGISCode {'\u25C6'}</Text>
        <Text color={theme.colors.text.muted} dimColor> v{pkg.version}</Text>
      </Box>
      <Box marginLeft={1} marginBottom={1}>
        <Text color={theme.colors.text.secondary}>AI-powered terminal coding assistant</Text>
      </Box>
      <Box marginLeft={2} flexDirection="column">
        <Text color={theme.colors.text.muted} dimColor>{'\u2502'} Type a message or use /commands</Text>
        <Text color={theme.colors.text.muted} dimColor>{'\u2502'} /help for available commands</Text>
        <Text color={theme.colors.text.muted} dimColor>{'\u2502'} /theme to change theme</Text>
        <Text color={theme.colors.text.muted} dimColor>{'\u2502'} /model to switch model</Text>
        <Text color={theme.colors.text.muted} dimColor>{'\u2502'} Ctrl+C to exit session</Text>
        <Text color={theme.colors.text.muted} dimColor>{'\u2502'} Ctrl+F to search messages</Text>
      </Box>
    </Box>
  );
});
WelcomeMessage.displayName = 'WelcomeMessage';

export default WelcomeMessage;
