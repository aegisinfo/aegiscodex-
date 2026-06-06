/**
 * ChatSearch - Ctrl+F inline search within messages
 *
 * Shows a search bar overlay when activated via Ctrl+F.
 * Highlights matching messages and allows cycling through results.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { themeManager } from '../../themes/index.js';
import { vanillaStore } from '../../../store/vanilla.js';
import type { FocusId } from '../../focus/index.js';

interface ChatSearchProps {
  /** Called when search is dismissed */
  onDismiss: () => void;
  /** Called with indices of matching messages */
  onResults?: (indices: number[], currentIndex: number) => void;
  /** The focus ID for input capture */
  focusId?: FocusId;
}

export const ChatSearch: React.FC<ChatSearchProps> = ({
  onDismiss,
  onResults,
}) => {
  const theme = themeManager.getTheme();
  const [query, setQuery] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const queryRef = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);

  const messages = useMemo(
    () => vanillaStore.getState().session.messages,
    // We need fresh messages each time search is active; re-compute on submit
  );

  const matchIndices = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return messages.reduce<number[]>((acc, msg, idx) => {
      if (msg.content.toLowerCase().includes(q)) acc.push(idx);
      return acc;
    }, []);
  }, [query, messages]);

  const totalMatches = matchIndices.length;

  useEffect(() => {
    setCurrentMatch(0);
    if (onResults) {
      onResults(matchIndices, 0);
    }
  }, [query]);

  const handleChange = useCallback((value: string) => {
    queryRef.current = value;
    setQuery(value);
    setCursorPos(value.length);
  }, []);

  const handlePrev = useCallback(() => {
    if (matchIndices.length === 0) return;
    const next = currentMatch > 0 ? currentMatch - 1 : matchIndices.length - 1;
    setCurrentMatch(next);
    if (onResults) onResults(matchIndices, next);
  }, [currentMatch, matchIndices, onResults]);

  const handleNext = useCallback(() => {
    if (matchIndices.length === 0) return;
    const next = currentMatch < matchIndices.length - 1 ? currentMatch + 1 : 0;
    setCurrentMatch(next);
    if (onResults) onResults(matchIndices, next);
  }, [currentMatch, matchIndices, onResults]);

  useInput((input, key) => {
    if (key.escape) {
      onDismiss();
      return;
    }
    if (key.return) {
      handleNext();
      return;
    }
    if (key.backspace || key.delete) {
      handleChange(queryRef.current.slice(0, -1));
      return;
    }
    if (key.tab) {
      handleNext();
      return;
    }
    if (key.shift && key.tab) {
      handlePrev();
      return;
    }
    if (key.upArrow) {
      handlePrev();
      return;
    }
    if (key.downArrow) {
      handleNext();
      return;
    }
    if (input && !key.ctrl && !key.meta && input.length === 1) {
      handleChange(queryRef.current + input);
    }
  });

  return (
    <Box
      flexDirection="row"
      paddingX={1}
      paddingY={0}
      borderStyle="round"
      borderColor={theme.colors.accent}
      marginBottom={0}
    >
      <Box marginRight={1}>
        <Text color={theme.colors.info} bold>
          {'\u2315'}
        </Text>
      </Box>

      <Box flexGrow={1}>
        <Text>
          <Text color={theme.colors.text.primary}>{query}</Text>
          <Text color={theme.colors.text.muted}>{'\u2502'}</Text>
        </Text>
      </Box>

      <Box marginRight={1}>
        <Text color={theme.colors.text.muted} dimColor>
          {totalMatches > 0
            ? `${currentMatch + 1}/${totalMatches}`
            : query.trim()
              ? '0/0'
              : ''}
        </Text>
      </Box>

      <Text color={theme.colors.text.muted} dimColor>
        {'n/N to navigate, Esc to close'}
      </Text>
    </Box>
  );
};

export default ChatSearch;
