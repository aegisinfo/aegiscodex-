/**
 * WelcomeMessage — claude-branded welcome with animated reveal.
 *
 * ◆ pulses from dim → white → coral, then "claude" sweeps char-by-char,
 * then tagline, divider and commands phase in sequentially.
 */

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { themeManager } from '../../themes/index.js';
import pkg from '../../../../package.json' with { type: 'json' };

interface WelcomeMessageProps {
  terminalWidth: number;
}

const ASCII_LOGO = [
  '╔═╗╔═╗╔═╗╦╔═╗',
  '╠═╣║╣ ║ ╦║╚═╗',
  '╩ ╩╚═╝╚═╝╩╚═╝',
];

const COMMANDS = [
  { cmd: '/help',    desc: 'all commands' },
  { cmd: '/model',   desc: 'switch AI model' },
  { cmd: '/theme',   desc: 'change appearance' },
  { cmd: '/compact', desc: 'compress context' },
];

// Divider that draws itself from width 0 to full
const DrawingDivider: React.FC<{ targetWidth: number }> = ({ targetWidth }) => {
  const theme = themeManager.getTheme();
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (width >= targetWidth) return;
    const id = setInterval(() => {
      setWidth(w => {
        if (w + 3 >= targetWidth) { clearInterval(id); return targetWidth; }
        return w + 3;
      });
    }, 10);
    return () => clearInterval(id);
  }, [targetWidth]);
  return (
    <Box>
      <Text color={theme.colors.border.light} dimColor>{'─'.repeat(width)}</Text>
    </Box>
  );
};

const FadeInCommand: React.FC<{ cmd: string; desc: string; delayMs: number }> = ({ cmd, desc, delayMs }) => {
  const theme = themeManager.getTheme();
  const [visible, setVisible] = useState(false);
  const [bright, setBright] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), delayMs);
    const t2 = setTimeout(() => setBright(true), delayMs + 100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [delayMs]);
  if (!visible) return null;
  return (
    <Box>
      <Text color={bright ? theme.colors.primary : theme.colors.text.muted} bold={bright}>
        {cmd.padEnd(12)}
      </Text>
      <Text color={theme.colors.text.muted} dimColor={!bright}>{desc}</Text>
    </Box>
  );
};

const FadeInText: React.FC<{ children: React.ReactNode; delayMs: number }> = ({ children, delayMs }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  if (!visible) return null;
  return <>{children}</>;
};

export const WelcomeMessage: React.FC<WelcomeMessageProps> = React.memo(({ terminalWidth }) => {
  const theme = themeManager.getTheme();
  const dividerWidth = Math.min(terminalWidth - 6, 34);

  // Logo lines reveal one by one
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const timers = ASCII_LOGO.map((_, i) =>
      setTimeout(() => setVisibleLines(i + 1), 80 + i * 120)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const logoColor = theme.colors.primary;
  const logoRevealMs = 80 + (ASCII_LOGO.length - 1) * 120 + 80;
  const taglineT = logoRevealMs + 60;
  const dividerT = logoRevealMs + 180;
  const cmdBaseT = logoRevealMs + 320;
  const footerT  = cmdBaseT + COMMANDS.length * 100 + 80;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>

      {/* ASCII logo — lines reveal top to bottom */}
      <Box flexDirection="column" marginBottom={1}>
        {ASCII_LOGO.map((line, i) => (
          <Box key={i} flexDirection="row">
            {i === 0 && (
              <Text color={theme.colors.text.muted} dimColor>{'  '}</Text>
            )}
            {i !== 0 && (
              <Text color={theme.colors.text.muted} dimColor>{'  '}</Text>
            )}
            {visibleLines > i ? (
              <Text color={logoColor} bold>{line}</Text>
            ) : (
              <Text>{' '.repeat(line.length)}</Text>
            )}
          </Box>
        ))}
        <FadeInText delayMs={logoRevealMs}>
          <Box marginLeft={2}>
            <Text color={theme.colors.text.muted} dimColor>{'  v' + pkg.version}</Text>
          </Box>
        </FadeInText>
      </Box>

      {/* Tagline */}
      <FadeInText delayMs={taglineT}>
        <Box marginTop={1} marginLeft={3}>
          <Text color={theme.colors.text.muted} dimColor>by Anthropic  ·  terminal coding agent</Text>
        </Box>
      </FadeInText>

      {/* Divider */}
      <FadeInText delayMs={dividerT}>
        <Box marginTop={1} marginBottom={1} marginLeft={3}>
          <DrawingDivider targetWidth={dividerWidth} />
        </Box>
      </FadeInText>

      {/* Commands */}
      <Box flexDirection="column" marginLeft={3} marginBottom={1}>
        {COMMANDS.map(({ cmd, desc }, i) => (
          <FadeInCommand
            key={cmd}
            cmd={cmd}
            desc={desc}
            delayMs={cmdBaseT + i * 100}
          />
        ))}
      </Box>

      {/* Footer */}
      <FadeInText delayMs={footerT}>
        <Box marginLeft={3}>
          <Text color={theme.colors.text.muted} dimColor>Ctrl+C exit  ·  Ctrl+F search</Text>
        </Box>
      </FadeInText>

    </Box>
  );
});

WelcomeMessage.displayName = 'WelcomeMessage';

export default WelcomeMessage;
