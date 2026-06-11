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

const ASCII_LOGO = [
  '   ╔═╗╔═╗╔═╗╦╔═╗',
  '   ╠═╣║╣ ║ ╦║╚═╗',
  '   ╩ ╩╚═╝╚═╝╩╚═╝',
]

const COMMANDS = [
  { cmd: '/help',     desc: 'all commands' },
  { cmd: '/model',    desc: 'switch AI model' },
  { cmd: '/theme',    desc: 'change appearance' },
  { cmd: '/compact',  desc: 'compress context' },
]

export const WelcomeMessage: React.FC<WelcomeMessageProps> = React.memo(({ terminalWidth }) => {
  const theme = themeManager.getTheme();
  const dividerWidth = Math.min(terminalWidth - 6, 38);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>

      {/* ASCII art + ✻ name on the right of the middle line */}
      <Box>
        <Box flexDirection="column">
          <Text color={theme.colors.primary} bold>{ASCII_LOGO[0]}</Text>
          <Text color={theme.colors.primary} bold>{ASCII_LOGO[1]}</Text>
          <Text color={theme.colors.primary} bold>{ASCII_LOGO[2]}</Text>
        </Box>
        <Box flexDirection="column" marginLeft={2}>
          <Box height={1} />
          <Box>
            <Text color={theme.colors.primary} bold>{'✻ '}</Text>
            <Text color={theme.colors.text.primary} bold>aegiscode</Text>
          </Box>
          <Box>
            <Text color={theme.colors.text.muted} dimColor>  v{pkg.version}</Text>
          </Box>
        </Box>
      </Box>

      {/* Tagline */}
      <Box marginTop={1} marginLeft={3}>
        <Text color={theme.colors.text.muted} dimColor>AI-powered terminal coding agent</Text>
      </Box>

      {/* Separator */}
      <Box marginTop={1} marginBottom={1} marginLeft={3}>
        <Text color={theme.colors.border.light} dimColor>{'─'.repeat(dividerWidth)}</Text>
      </Box>

      {/* Commands */}
      <Box flexDirection="column" marginLeft={3} marginBottom={1}>
        {COMMANDS.map(({ cmd, desc }) => (
          <Box key={cmd}>
            <Text color={theme.colors.primary}>{cmd.padEnd(12)}</Text>
            <Text color={theme.colors.text.muted} dimColor>{desc}</Text>
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Box marginLeft={3}>
        <Text color={theme.colors.text.muted} dimColor>Ctrl+C exit  ·  Ctrl+F search</Text>
      </Box>

    </Box>
  );
});
WelcomeMessage.displayName = 'WelcomeMessage';

export default WelcomeMessage;
