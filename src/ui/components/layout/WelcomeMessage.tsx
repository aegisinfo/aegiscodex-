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
  { cmd: '/copy',    desc: 'copy code/text to clipboard' },
  { cmd: '/compact', desc: 'compress context' },
];

/** Keeps fade-in state alive across remounts (e.g. selector closing) */
const fadePlayedRef = { current: false };

const FadeInCommand: React.FC<{ cmd: string; desc: string; delayMs: number }> = ({ cmd, desc, delayMs }) => {
  const theme = themeManager.getTheme();
  const [visible, setVisible] = useState(fadePlayedRef.current);
  useEffect(() => {
    if (fadePlayedRef.current) return;
    const t = setTimeout(() => {
      fadePlayedRef.current = true;
      setVisible(true);
    }, delayMs);
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
    <Box flexDirection="column" paddingX={0} paddingY={0} marginBottom={1}>
      {/* ASCII art logo — kept in sync with assets/demo.svg */}
      <Box flexDirection="column">
        <Text color={theme.colors.primary} bold>{`
  ╔═╗╔═╗╔═╗╦╔═╗
  ╠═╣║╣ ║ ╦║╚═╗
  ╩ ╩╚═╝╚═╝╩╚═╝`}</Text>
        <Box marginLeft={2}>
          <Text color={theme.colors.text.muted} dimColor>v{pkg.version}</Text>
        </Box>
        <Box marginLeft={2}>
          <Text color={theme.colors.primary} bold>ÆGIS  </Text>
          <Text color={theme.colors.text.muted} dimColor>·  terminal coding agent</Text>
        </Box>
        <Box marginLeft={2}>
          <Text color={theme.colors.text.muted} dimColor>──────────────────────────────────────</Text>
        </Box>
      </Box>

      {/* Commands */}
      <Box flexDirection="column" marginTop={0} marginLeft={2}>
        {COMMANDS.map(({ cmd, desc }, i) => (
          <FadeInCommand key={cmd} cmd={cmd} desc={desc} delayMs={cmdBaseT + i * 100} />
        ))}
      </Box>

      {/* Footer */}
      <Box marginTop={0} marginLeft={2}>
        <Text color={theme.colors.text.muted} dimColor>Ctrl+Z exit  ·  Ctrl+F search  ·  Alt+C copy last</Text>
      </Box>

      {/* Claude Pro/Max tip — only shown when subscription auth isn't already set up */}
      {!process.env.CLAUDE_CODE_OAUTH_TOKEN && (
        <Box marginTop={0} marginLeft={2}>
          <Text color={theme.colors.text.muted} dimColor>Have Claude Pro/Max? Run aegis login --claude-pro to use your subscription</Text>
        </Box>
      )}
    </Box>
  );
});

WelcomeMessage.displayName = 'WelcomeMessage';

export default WelcomeMessage;
