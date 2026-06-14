/**
 * CommandSuggestions - Dropdown autocomplete for slash commands
 *
 * Shows fuzzy-matched command suggestions when user types "/..."
 */

import React, { useMemo, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { getCommandCompletions } from '../../../slash-commands/index.js';
import { themeManager } from '../../themes/index.js';
import { FocusId, focusManager } from '../../focus/index.js';

interface CommandSuggestionsProps {
  /** The current input value */
  input: string;
  /** Cursor position */
  cursorPosition: number;
  /** Callback to set input value (for tab-complete) */
  onSelectSuggestion: (suggestion: string) => void;
  /** Whether suggestions are visible */
  visible: boolean;
}

export const CommandSuggestions: React.FC<CommandSuggestionsProps> = ({
  input,
  cursorPosition,
  onSelectSuggestion,
  visible,
}) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const theme = themeManager.getTheme();

  // Reset selection when suggestions change
  const lastInputRef = useRef(input);
  useEffect(() => {
    if (lastInputRef.current !== input) {
      setSelectedIndex(0);
      lastInputRef.current = input;
    }
  }, [input]);

  const suggestions = useMemo(() => {
    if (!visible || !input.startsWith('/')) return [];

    const partial = input.slice(0, cursorPosition);
    const results = getCommandCompletions(partial);
    const isListing = partial.trim() === '/';

    if (isListing) {
      // Alphabetical when showing all commands
      results.sort((a, b) => a.command.localeCompare(b.command));
    } else {
      results.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
    }
    return results;
  }, [input, cursorPosition, visible]);

  // Clamp selected index
  const clampedIndex = Math.min(selectedIndex, Math.max(0, suggestions.length - 1));

  // Tab key: cycle through suggestions
  useInput(
    (_, key) => {
      if (!visible || suggestions.length === 0) return;
      if (focusManager.getCurrentFocus() !== FocusId.MAIN_INPUT) return;

      if (key.tab && !key.shift) {
        // Select next suggestion (cycle)
        const next = (clampedIndex + 1) % suggestions.length;
        setSelectedIndex(next);
        return;
      }

      if (key.tab && key.shift) {
        // Select previous suggestion
        const prev = clampedIndex <= 0 ? suggestions.length - 1 : clampedIndex - 1;
        setSelectedIndex(prev);
        return;
      }

      // Enter on a suggestion: select it
      if (key.return && suggestions.length > 0) {
        const selected = suggestions[clampedIndex];
        if (selected) {
          // Replace the command part of the input
          const beforeCursor = input.slice(0, cursorPosition);
          const afterCursor = input.slice(cursorPosition);
          const slashIdx = beforeCursor.lastIndexOf('/');

          if (slashIdx !== -1) {
            const newBefore = beforeCursor.slice(0, slashIdx);
            const completed = `${newBefore}${selected.command} `;
            onSelectSuggestion(completed + afterCursor);
          }
        }
      }
    },
    { isActive: visible && suggestions.length > 0 }
  );

  if (!visible || suggestions.length === 0) return null;

  return (
    <Box
      flexDirection="column"
      marginLeft={1}
      marginBottom={0}
      borderStyle="round"
      borderColor={theme.colors.border.light}
      paddingX={1}
      paddingY={0}
    >
      <Text dimColor>Commands ({suggestions.length}):</Text>
      {suggestions.map((s, i) => {
        const isSelected = i === clampedIndex;
        return (
          <Box key={s.command} flexDirection="row">
            <Text>
              {isSelected ? (
                <Text color={theme.colors.primary} bold>{'>'}</Text>
              ) : (
                <Text> </Text>
              )}{' '}
              <Text color={isSelected ? theme.colors.primary : undefined} bold={isSelected}>
                {s.command}
              </Text>
              <Text color={theme.colors.text.muted}> — {s.description}</Text>
            </Text>
          </Box>
        );
      })}
      <Text dimColor>
        Tab/Shift+Tab to navigate · Enter to select
      </Text>
    </Box>
  );
};

export default CommandSuggestions;
