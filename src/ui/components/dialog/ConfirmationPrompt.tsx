/**
 * ConfirmationPrompt - 权限确认组件
 * 
 * 
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { themeManager } from '../../themes/index.js';
import { FocusId, focusManager, useIsFocused } from '../../focus/index.js';
import type { ConfirmationDetails, ConfirmationResponse } from '../../../agent/types.js';

interface ConfirmationPromptProps {
  details: ConfirmationDetails;
  onResponse: (response: ConfirmationResponse) => void;
}

export const ConfirmationPrompt: React.FC<ConfirmationPromptProps> = ({
  details,
  onResponse,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const theme = themeManager.getTheme();
  const isFocused = useIsFocused(FocusId.CONFIRMATION_PROMPT);

  const options = [
    { key: 'y', label: 'allow', scope: 'once' as const, approved: true },
    { key: 'a', label: 'always', scope: 'session' as const, approved: true },
    { key: 'n', label: 'deny', scope: 'once' as const, approved: false },
    { key: 'd', label: 'never', scope: 'session' as const, approved: false },
  ];

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      const sel = options[selectedIndex];
      onResponse({ approved: sel.approved, scope: sel.scope, reason: sel.approved ? undefined : 'denied' });
    } else if (input === 'y' || input === 'Y') {
      onResponse({ approved: true, scope: 'once' });
    } else if (input === 'a' || input === 'A') {
      onResponse({ approved: true, scope: 'session' });
    } else if (input === 'n' || input === 'N') {
      onResponse({ approved: false, scope: 'once', reason: 'denied' });
    } else if (input === 'd' || input === 'D') {
      onResponse({ approved: false, scope: 'session', reason: 'denied for this session' });
    }
  }, { isActive: isFocused });

  // Extract tool name from title (e.g. "Permission Required: Bash" -> "Bash")
  const toolName = details.title.replace(/^.*:\s*/, '');

  // Skip showing the tool name header for tools where the label+highlight is self-explanatory
  const hideHeader = ['Bash', 'Shell'].includes(toolName) && details.details?.includes('**Command:**');

  // Extract the primary content to highlight (command, file path, etc.)
  const { label, highlight, extra } = extractHighlight(details.details);

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header: tool name + reason (skipped for bash/shell when command is shown) */}
      {!hideHeader && (
        <Box>
          <Text color={theme.colors.warning} bold>? </Text>
          <Text bold>{toolName}</Text>
          {details.message && details.message !== details.title && (
            <Text color={theme.colors.text.muted} dimColor> · {details.message}</Text>
          )}
        </Box>
      )}

      {/* When header is hidden (Bash/Shell), show "? Command: <cmd>" on one line */}
      {hideHeader && highlight && (
        <Box>
          <Text color={theme.colors.warning} bold>? </Text>
          {label && <Text color={theme.colors.text.muted} dimColor>{label} </Text>}
          <Text color={theme.colors.accent} wrap="wrap">{highlight}</Text>
        </Box>
      )}

      {/* Highlighted content (command / file path) — only when header is shown */}
      {!hideHeader && highlight && (
        <Box marginLeft={2}>
          {label && <Text color={theme.colors.text.muted} dimColor>{label} </Text>}
          <Text color={theme.colors.accent} wrap="wrap">{highlight}</Text>
        </Box>
      )}

      {/* Extra detail lines (e.g. directory, content preview) */}
      {extra.length > 0 && (
        <Box flexDirection="column" marginLeft={2}>
          {extra.map((line, i) => (
            <Text key={i} color={theme.colors.text.muted} dimColor wrap="wrap">
              {line}
            </Text>
          ))}
        </Box>
      )}

      {/* Affected files */}
      {details.affectedFiles && details.affectedFiles.length > 0 && (
        <Box marginLeft={2}>
          <Text color={theme.colors.info} dimColor>
            {details.affectedFiles.join(', ')}
          </Text>
        </Box>
      )}

      {/* Risks - single line */}
      {details.risks && details.risks.length > 0 && (
        <Box marginLeft={2}>
          <Text color={theme.colors.text.muted} dimColor>
            {details.risks.join(' · ')}
          </Text>
        </Box>
      )}

      {/* Options - vertical, up/down selection */}
      <Box flexDirection="column" marginLeft={2} marginTop={1}>
        {options.map((opt, i) => {
          const active = i === selectedIndex;
          return (
            <Box key={opt.key}>
              <Text
                color={active ? theme.colors.success : theme.colors.text.muted}
                bold={active}
                dimColor={!active}
              >
                {active ? '> ' : '  '}
                {opt.label}
              </Text>
              <Text color={theme.colors.text.muted} dimColor>  ({opt.key})</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

/**
 * 
 * 
 */
function extractHighlight(details?: string): { label: string; highlight: string; extra: string[] } {
  if (!details) return { label: '', highlight: '', extra: [] };

  const strip = (s: string) =>
    s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();

  const lines = details.split('\n').filter(l => l.trim());
  let label = '';
  let highlight = '';
  const highlightLines: string[] = [];
  const extra: string[] = [];
  let inHighlight = false;

  const KNOWN_PREFIX = /^(Command|File|Directory|Content Preview|Before|After):\s*/;

  for (const raw of lines) {
    const line = strip(raw);
    if (line === '```' || line.startsWith('```')) {
      // skip code fences
      continue;
    }
    if (/^Command:\s*/.test(line)) {
      label = 'Command:';
      highlightLines.push(line.replace(/^Command:\s*/, ''));
      inHighlight = true;
    } else if (/^File:\s*/.test(line)) {
      label = 'File:';
      highlightLines.push(line.replace(/^File:\s*/, ''));
      inHighlight = true;
    } else if (/^(Directory|Content Preview|Before|After):\s*/.test(line)) {
      inHighlight = false;
      extra.push(line);
    } else if (inHighlight) {
      // Continuation of a multi-line Command/File value — keep it part of the
      // highlight instead of dropping it into the unrelated "extra" lines, or
      // multi-line bash commands get silently truncated to their first line.
      highlightLines.push(line);
    } else if (line) {
      extra.push(line);
    }
  }

  highlight = highlightLines.join('\n');

  return { label, highlight, extra };
}

/**
 * 
 * 
 */
export function createAutoConfirmationHandler(
  mode: 'approve' | 'deny' | 'approve_session' = 'deny'
): (details: ConfirmationDetails) => Promise<ConfirmationResponse> {
  return async () => ({
    approved: mode.startsWith('approve'),
    scope: mode === 'approve_session' ? 'session' : 'once',
    reason: `Auto-${mode} by non-interactive mode`,
  });
}

export default ConfirmationPrompt;
