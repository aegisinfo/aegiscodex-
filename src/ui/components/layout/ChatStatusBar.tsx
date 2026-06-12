/**
 * ChatStatusBar - 聊天状态栏组件
 * 
 * 
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useShallow } from 'zustand/react/shallow';
import { themeManager } from '../../themes/index.js';
import {
  useClawdStore,
} from '../../../store/index.js';

interface ChatStatusBarProps {
  /** 当前模型 */
  model?: string;
  /** 是否显示 */
  isVisible?: boolean;
  /** Whether user has scrolled up (show hint to scroll back down) */
  isScrolledUp?: boolean;
}

/**
 * 
 */
function formatTokens(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

/**
 * 
 */
export const ChatStatusBar: React.FC<ChatStatusBarProps> = React.memo(({
  model,
  isVisible = true,
  isScrolledUp = false,
}) => {
  const theme = themeManager.getTheme();
  const displayModel = model;

  // Single store subscription with shallow comparison — avoids cascading
  // re-renders when unrelated store slices change (e.g. isThinking during streaming).
  // The 4 individual selectors were causing 4 separate subscriptions.
  const { sessionId, tokenUsage, messageCount, queuedCommands } = useClawdStore(
    useShallow((state) => ({
      sessionId: state.session.sessionId,
      tokenUsage: state.session.tokenUsage,
      messageCount: state.session.messages.length,
      queuedCommands: state.command.pendingCommands.length,
    }))
  );

  if (!isVisible) {
    return null;
  }

  // 构建状态项（使用简洁的文字标
  const segments: Array<{ content: React.ReactNode; dimmed?: boolean }> = [];

  // Model - 核心信息，高亮显
  if (displayModel) {
    segments.push({
      content: (
        <>
          <Text color={theme.colors.text.muted}>model:</Text>
          <Text color={theme.colors.primary} bold>{displayModel.length > 24 ? displayModel.slice(0, 24) + '…' : displayModel}</Text>
        </>
      ),
    });
  }

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

  // Queue (only if > 0)
  if (queuedCommands > 0) {
    segments.push({
      content: (
        <>
          <Text color={theme.colors.text.muted}>queue:</Text>
          <Text color={theme.colors.warning}>{queuedCommands}</Text>
        </>
      ),
    });
  }

  // Tokens - input/output format
  if (tokenUsage && (tokenUsage.inputTokens + tokenUsage.outputTokens) > 0) {
    segments.push({
      content: (
        <>
          <Text color={theme.colors.text.muted}>tokens:</Text>
          <Text color={theme.colors.info}>
            {formatTokens(tokenUsage.inputTokens)}/{formatTokens(tokenUsage.outputTokens)}
          </Text>
        </>
      ),
    });
  }



  // Scroll hint when scrolled up
  if (isScrolledUp) {
    segments.unshift({
      content: (
        <>
          <Text color={theme.colors.warning}>↑ PgDn/End to go back</Text>
        </>
      ),
      dimmed: false,
    });
  }

  // Session ID
  if (sessionId) {
    segments.push({
      content: (
        <>
          <Text color={theme.colors.text.muted}>sid:</Text>
          <Text color={theme.colors.info} dimColor>{sessionId.slice(0, 8)}</Text>
        </>
      ),
    });
  }

  if (segments.length === 0) {
    return null;
  }

  return (
    <Box
      flexDirection="row"
      justifyContent="flex-start"
      paddingX={0}
      marginTop={0}
    >
      <Text color={theme.colors.primary} dimColor>◆ </Text>
      {segments.map((seg, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <Text color={theme.colors.text.muted} dimColor> · </Text>
          )}
          <Text dimColor={seg.dimmed}>{seg.content}</Text>
        </React.Fragment>
      ))}
      <Text color={theme.colors.text.muted} dimColor> ─</Text>
    </Box>
  );
});

ChatStatusBar.displayName = 'ChatStatusBar';

export default ChatStatusBar;
