/**
 * WelcomeMessage — ASCII art logo + available commands.
 */

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { themeManager } from '../../themes/index.js';
import pkg from '../../../../package.json' with { type: 'json' };

interface WelcomeMessageProps {
  terminalWidth: number;
}

const COMMANDS = [
  { cmd: '/help',    desc: 'all commands' },
  { cmd: '/model',   desc: 'switch AI model' },
  { cmd: '/theme',   desc: 'change appearance' },
  { cmd: '/compact', desc: 'compress context' },
];

const FadeInCommand: React.FC<{ cmd: string; desc: string; delayMs: number }> = ({ cmd, desc, delayMs }) => {
  const theme = themeManager.getTheme();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  if (!visible) return null;
  return (
    <Box>
      <Text color={theme.colors.text.muted} dimColor>{cmd.padEnd(12)}{desc}</Text>
    </Box>
  );
};

export const WelcomeMessage: React.FC<WelcomeMessageProps> = React.memo(({ terminalWidth }) => {
  const theme = themeManager.getTheme();
  const cmdBaseT = 80;
  const footerT  = cmdBaseT + COMMANDS.length * 100 + 80;

  return (
    <Box flexDirection="column" paddingX={0} paddingY={0} marginBottom={0}>
      {/* ASCII art logo */}
      <Box flexDirection="column">
        <Text color={theme.colors.primary}>{`
    █████╗ ███████╗ ██████╗ ██╗███████╗
   ██╔══██╗██╔════╝██╔════╝ ██║██╔════╝
   ███████║█████╗  ██║  ███╗██║███████╗
   ██╔══██║██╔══╝  ██║   ██║██║╚════██║
   ██║  ██║███████╗╚██████╔╝██║███████║
   ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝`}</Text>
        <Text color={theme.colors.text.muted} dimColor>  v{pkg.version} · terminal coding agent</Text>
      </Box>

      {/* Commands */}
      <Box flexDirection="column" marginTop={0}>
        {COMMANDS.map(({ cmd, desc }, i) => (
          <FadeInCommand key={cmd} cmd={cmd} desc={desc} delayMs={cmdBaseT + i * 100} />
        ))}
      </Box>

      {/* Footer */}
      <Box marginTop={0}>
        <Text color={theme.colors.text.muted} dimColor>Ctrl+Z exit  ·  Ctrl+F search</Text>
      </Box>
    </Box>
  );
});

WelcomeMessage.displayName = 'WelcomeMessage';

export default WelcomeMessage;
