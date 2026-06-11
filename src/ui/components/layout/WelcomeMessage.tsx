/**
 * WelcomeMessage - animated ink-flow reveal on startup
 *
 * The ASCII logo is swept character-by-character (left→right, top→bottom)
 * with a colour gradient: dim (unwritten) → white nib → wet teal → dry primary.
 * After the sweep, content phases in sequentially.
 */

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { themeManager } from '../../themes/index.js';
import pkg from '../../../../package.json' with { type: 'json' };

interface WelcomeMessageProps {
  terminalWidth: number;
}

const LOGO_LINES = [
  '   ╔═╗╔═╗╔═╗╦╔═╗',
  '   ╠═╣║╣ ║ ╦║╚═╗',
  '   ╩ ╩╚═╝╚═╝╩╚═╝',
];

const LINE_LENGTHS = LOGO_LINES.map(l => l.length);
const TOTAL_LOGO_CHARS = LINE_LENGTHS.reduce((s, l) => s + l, 0);

const COMMANDS = [
  { cmd: '/help',    desc: 'all commands' },
  { cmd: '/model',   desc: 'switch AI model' },
  { cmd: '/theme',   desc: 'change appearance' },
  { cmd: '/compact', desc: 'compress context' },
];

// Colour at each character relative to the sweep nib position
function charColor(
  globalPos: number,
  sweepPos: number,
  primary: string,
  muted: string,
): { color: string; dim: boolean; bold: boolean } {
  if (sweepPos < 0) return { color: muted, dim: true, bold: false };
  if (globalPos > sweepPos)   return { color: muted, dim: true,  bold: false }; // unwritten
  if (globalPos === sweepPos) return { color: '#ffffff', dim: false, bold: true  }; // nib
  if (globalPos >= sweepPos - 2) return { color: '#7dffd9', dim: false, bold: true  }; // wet ink
  return { color: primary, dim: false, bold: true }; // dry ink
}

// A single logo line rendered char-by-char so each gets its own colour
const LogoLine: React.FC<{
  line: string;
  lineStart: number;
  sweepPos: number;
}> = React.memo(({ line, lineStart, sweepPos }) => {
  const theme = themeManager.getTheme();
  return (
    <Box flexDirection="row">
      {Array.from(line).map((ch, ci) => {
        const gp = lineStart + ci;
        const { color, dim, bold } = charColor(gp, sweepPos, theme.colors.primary, theme.colors.text.muted);
        return (
          <Text key={ci} color={color} dimColor={dim} bold={bold}>
            {ch}
          </Text>
        );
      })}
    </Box>
  );
});
LogoLine.displayName = 'LogoLine';

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
    }, 12);
    return () => clearInterval(id);
  }, [targetWidth]);
  return (
    <Box>
      <Text color={theme.colors.border.light} dimColor>
        {'─'.repeat(width)}
      </Text>
    </Box>
  );
};

// A command row that fades in (dim → normal)
const FadeInCommand: React.FC<{ cmd: string; desc: string; delayMs: number }> = ({ cmd, desc, delayMs }) => {
  const theme = themeManager.getTheme();
  const [visible, setVisible] = useState(false);
  const [bright, setBright] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), delayMs);
    const t2 = setTimeout(() => setBright(true), delayMs + 120);
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

// A text row that fades in after a delay
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
  const dividerWidth = Math.min(terminalWidth - 6, 38);

  // sweepPos: which global char index the "nib" is currently at (-1 = not started)
  const [sweepPos, setSweepPos] = useState(-1);

  // Start sweep on mount
  useEffect(() => {
    let pos = -1;
    const id = setInterval(() => {
      pos += 1;
      setSweepPos(pos);
      if (pos >= TOTAL_LOGO_CHARS + 3) clearInterval(id);
    }, 15);
    return () => clearInterval(id);
  }, []);

  // After sweep, content phases in via individual FadeIn components.
  // sweepEnd ≈ 15ms × (54 + 3) = ~855ms from mount.
  const sweepEndMs = (TOTAL_LOGO_CHARS + 3) * 15;
  const nameT    = sweepEndMs + 80;
  const taglineT = sweepEndMs + 220;
  const dividerT = sweepEndMs + 380;
  const cmdBaseT = sweepEndMs + 540;
  const footerT  = cmdBaseT + COMMANDS.length * 120 + 100;

  // Precompute line start positions
  let lineStarts: number[] = [];
  let acc = 0;
  for (const len of LINE_LENGTHS) { lineStarts.push(acc); acc += len; }

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>

      {/* Logo + name row */}
      <Box>
        <Box flexDirection="column">
          {LOGO_LINES.map((line, i) => (
            <LogoLine
              key={i}
              line={line}
              lineStart={lineStarts[i]}
              sweepPos={sweepPos}
            />
          ))}
        </Box>

        <FadeInText delayMs={nameT}>
          <Box flexDirection="column" marginLeft={2}>
            <Box height={1} />
            <Box>
              <Text color={theme.colors.primary} bold>{'✻ '}</Text>
              <Text color={theme.colors.text.primary} bold>aegiscode</Text>
            </Box>
            <Box>
              <Text color={theme.colors.text.muted} dimColor>{'  '}v{pkg.version}</Text>
            </Box>
          </Box>
        </FadeInText>
      </Box>

      {/* Tagline */}
      <FadeInText delayMs={taglineT}>
        <Box marginTop={1} marginLeft={3}>
          <Text color={theme.colors.text.muted} dimColor>AI-powered terminal coding agent</Text>
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
            delayMs={cmdBaseT + i * 120}
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
