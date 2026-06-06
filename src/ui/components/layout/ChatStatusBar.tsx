/**
 * ChatStatusBar - Enhanced status bar with rich info
 *
 * Shows model, messages, queue, tokens, session, context,
 * todos, and whether compacting.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { themeManager } from '../../themes/index.js';
import {
  useSessionId,
  useTokenUsage,
  useMessageCount,
  usePendingCommands,
  useContextRemaining,
  useIsCompacting,
  useTodoStats,
} from '../../../store/index.js';

interface ChatStatusBarProps {
  model?: string;
  isVisible?: boolean;
}

/**
 * Format token counts to human-readable strings
 */
function formatTokens(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

export const ChatStatusBar: React.FC<ChatStatusBarProps> = React.memo(({
  model,
  isVisible = true,
}) => {
  const theme = themeManager.getTheme();
  const sessionId = useSessionId();
  const tokenUsage = useTokenUsage();
  const messageCount = useMessageCount();
  const queuedCommands = usePendingCommands().length;
  const contextRemaining = useContextRemaining();
  const isCompacting = useIsCompacting();
  const todoStats = useTodoStats();
  const themeName = theme.name;
  const displayModel = model;

  if (!isVisible) return null;

  const segments: Array<{ content: React.ReactNode; dimmed?: boolean }> = [];

  // Model
  if (displayModel) {
    const short = displayModel.length > 20
      ? displayModel.slice(0, 18) + '…'
      : displayModel;
    segments.push({
      content: (
        <>
          <Text color={theme.colors.text.muted}>M:</Text>
          <Text color={theme.colors.primary} bold>{short}</Text>
        </>
      ),
    });
  }

  // Theme name
  segments.push({
    content: (
      <>
        <Text color={theme.colors.text.muted}>T:</Text>
        <Text color={theme.colors.secondary}>{themeName}</Text>
      </>
    ),
  });

  // Messages count
  if (messageCount !== undefined) {
    segments.push({
      content: (
        <>
          <Text color={theme.colors.text.muted}>msgs:</Text>
          <Text color={theme.colors.text.secondary}>{messageCount}</Text>
        </>
      ),
    });
  }

  // Queue indicator
  if (queuedCommands > 0) {
    segments.push({
      content: (
        <>
          <Text color={theme.colors.text.muted}>q:</Text>
          <Text color={theme.colors.warning}>{queuedCommands}</Text>
        </>
      ),
    });
  }

  // Compacting indicator
  if (isCompacting) {
    segments.push({
      content: (
        <Text color={theme.colors.warning}>compacting</Text>
      ),
    });
  }

  // Context remaining bar
  if (contextRemaining !== undefined && contextRemaining < 100) {
    const barLen = 6;
    const filled = Math.round((contextRemaining / 100) * barLen);
    const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
    const color = contextRemaining < 20 ? theme.colors.error
      : contextRemaining < 50 ? theme.colors.warning
      : theme.colors.success;
    segments.push({
      content: (
        <>
          <Text color={theme.colors.text.muted}>ctx:</Text>
          <Text color={color}>{bar}</Text>
          <Text color={theme.colors.text.muted}>{contextRemaining}%</Text>
        </>
      ),
    });
  }

  // Tokens
  if (tokenUsage && (tokenUsage.inputTokens + tokenUsage.outputTokens) > 0) {
    const total = tokenUsage.inputTokens + tokenUsage.outputTokens;
    const max = tokenUsage.maxContextTokens || 200000;
    const pct = Math.round((total / max) * 100);
    segments.push({
      content: (
        <>
          <Text color={theme.colors.text.muted}>tok:</Text>
          <Text color={theme.colors.info}>
            {formatTokens(tokenUsage.inputTokens)}↑{formatTokens(tokenUsage.outputTokens)}↓
          </Text>
          <Text color={theme.colors.text.muted} dimColor>/{pct}%</Text>
        </>
      ),
    });
  }

  // Todo stats
  if (todoStats.total > 0) {
    segments.push({
      content: (
        <>
          <Text color={theme.colors.text.muted}>todo:</Text>
          <Text color={todoStats.completed === todoStats.total ? theme.colors.success : theme.colors.text.secondary}>
            {todoStats.completed}/{todoStats.total}
          </Text>
        </>
      ),
    });
  }

  if (segments.length === 0) return null;

  return (
    <Box
      flexDirection="row"
      justifyContent="flex-start"
      paddingX={0}
      marginTop={0}
    >
      <Text color={theme.colors.text.muted} dimColor> {'\u2500'} </Text>
      {segments.map((seg, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <Text color={theme.colors.text.muted} dimColor> {'\u00B7'} </Text>
          )}
          <Text dimColor={seg.dimmed}>{seg.content}</Text>
        </React.Fragment>
      ))}
      <Text color={theme.colors.text.muted} dimColor> {'\u2500'}</Text>
    </Box>
  );
});

ChatStatusBar.displayName = 'ChatStatusBar';

export default ChatStatusBar;
