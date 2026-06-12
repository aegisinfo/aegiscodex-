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

const CLAUDE_LETTERS = Array.from('claude');
const TOTAL_SWEEP = CLAUDE_LETTERS.length;

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

  // ◆ glow phase: 0 = dim, 1 = white, 2 = coral (settled)
  const [logoPhase, setLogoPhase] = useState(0);

  // Sweep position for "claude" letters (-1 = none revealed)
  const [sweepPos, setSweepPos] = useState(-1);

  useEffect(() => {
    // ◆ glow sequence
    const t1 = setTimeout(() => setLogoPhase(1), 80);
    const t2 = setTimeout(() => setLogoPhase(2), 240);

    // Start sweeping letters after glow settles
    let pos = -1;
    const id = setInterval(() => {
      pos += 1;
      setSweepPos(pos);
      if (pos >= TOTAL_SWEEP + 2) clearInterval(id);
    }, 55);

    return () => { clearTimeout(t1); clearTimeout(t2); clearInterval(id); };
  }, []);

  const logoColor = logoPhase === 0 ? theme.colors.text.muted
                  : logoPhase === 1 ? '#ffffff'
                  : theme.colors.primary;

  // After sweep ends, content phases in
  const sweepEndMs = 240 + (TOTAL_SWEEP + 2) * 55;
  const taglineT  = sweepEndMs + 60;
  const dividerT  = sweepEndMs + 180;
  const cmdBaseT  = sweepEndMs + 320;
  const footerT   = cmdBaseT + COMMANDS.length * 100 + 80;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>

      {/* Logo row: ◆  claude  vX.X.X */}
      <Box flexDirection="row" alignItems="flex-end">
        {/* The ◆ diamond */}
        <Text color={logoColor} bold>{'◆  '}</Text>

        {/* "claude" swept char by char */}
        {CLAUDE_LETTERS.map((ch, i) => {
          const revealed = sweepPos >= i;
          const isNib    = sweepPos === i;
          const color    = !revealed    ? 'transparent'
                         : isNib        ? '#ffffff'
                         : theme.colors.text.primary;
          return (
            <Text key={i} color={revealed ? color : theme.colors.text.muted} bold dimColor={!revealed}>
              {revealed ? ch : ' '}
            </Text>
          );
        })}

        {/* Version — fades in after sweep */}
        <FadeInText delayMs={sweepEndMs}>
          <Text color={theme.colors.text.muted} dimColor>{'  v' + pkg.version}</Text>
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
