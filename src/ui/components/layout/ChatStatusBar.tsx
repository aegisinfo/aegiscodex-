/**
 * ChatStatusBar — Claude Code style minimal status bar
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useShallow } from 'zustand/react/shallow';
import { themeManager } from '../../themes/index.js';
import { useClawdStore } from '../../../store/index.js';

interface ChatStatusBarProps {
  model?: string;
  /** True when `model` was picked by the auto-router rather than /model */
  modelIsAuto?: boolean;
  isVisible?: boolean;
  isScrolledUp?: boolean;
  renderLatency?: number;
}

function formatTokens(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

export const ChatStatusBar: React.FC<ChatStatusBarProps> = React.memo(({
  model,
  modelIsAuto = false,
  isVisible = true,
  isScrolledUp = false,
  renderLatency = 0,
}) => {
  const theme = themeManager.getTheme();
  const displayModel = model;

  const { messageCount, queuedCommands } = useClawdStore(
    useShallow((state) => ({
      messageCount:     state.session.messages.length,
      queuedCommands:   state.command.pendingCommands.length,
    }))
  );

  if (!isVisible) return null;

  const items: string[] = [];

  if (displayModel) {
    const truncated = displayModel.length > 24 ? displayModel.slice(0, 24) + '…' : displayModel;
    items.push(modelIsAuto ? `${truncated} (auto)` : truncated);
  }

  if (renderLatency > 50) {
    items.push(`lag: ${renderLatency}ms`);
  }

  if (messageCount !== undefined) {
    items.push(`${messageCount} msgs`);
  }

  if (isScrolledUp) {
    items.push('↑ scrolled');
  }

  if (queuedCommands > 0) {
    items.push(`queue: ${queuedCommands}`);
  }

  if (items.length === 0) return null;

  return (
    <Box flexDirection="row" paddingX={0} marginTop={0}>
      <Text color={theme.colors.text.muted} dimColor>
        {items.join(' · ')}
      </Text>
    </Box>
  );
});

ChatStatusBar.displayName = 'ChatStatusBar';

export default ChatStatusBar;
