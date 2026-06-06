/**
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { CommandSuggestion } from '../../../slash-commands/types.js';
import { themeManager } from '../../themes/index.js';

interface CommandSuggestionsProps {
  
  suggestions: CommandSuggestion[];
  
  selectedIndex: number;
  
  visible: boolean;
}

const MAX_VISIBLE = 10;

/**
 * 
 */
export const CommandSuggestions: React.FC<CommandSuggestionsProps> = ({
  suggestions,
  selectedIndex,
  visible,
}) => {
  const theme = themeManager.getTheme();
  const { displaySuggestions, startIndex } = useMemo(() => {
    if (suggestions.length <= MAX_VISIBLE) {
      return { displaySuggestions: suggestions, startIndex: 0 };
    }
    let start = Math.max(0, selectedIndex - Math.floor(MAX_VISIBLE / 2));
    if (start + MAX_VISIBLE > suggestions.length) {
      start = suggestions.length - MAX_VISIBLE;
    }

    return {
      displaySuggestions: suggestions.slice(start, start + MAX_VISIBLE),
      startIndex: start,
    };
  }, [suggestions, selectedIndex]);

  if (!visible || suggestions.length === 0) {
    return null;
  }

  const hasMoreAbove = startIndex > 0;
  const hasMoreBelow = startIndex + MAX_VISIBLE < suggestions.length;

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      marginBottom={0}
    >
      {}
      {hasMoreAbove && (
        <Text color={theme.colors.text.muted} dimColor>
          ... {startIndex} more above
        </Text>
      )}
      
      {displaySuggestions.map((suggestion, displayIndex) => {
        const actualIndex = startIndex + displayIndex;
        const isSelected = actualIndex === selectedIndex;
        
        return (
          <Box key={suggestion.command} flexDirection="row">
            {}
            <Text color={isSelected ? theme.colors.primary : theme.colors.text.muted}>
              {isSelected ? '> ' : '  '}
            </Text>
            
            {}
            <Text
              color={isSelected ? theme.colors.primary : theme.colors.success}
              bold={isSelected}
            >
              {suggestion.command}
            </Text>
            
            {}
            <Text color={theme.colors.text.muted} dimColor={!isSelected}>
              {' '}
              {suggestion.description}
            </Text>
          </Box>
        );
      })}
      
      {}
      {hasMoreBelow && (
        <Text color={theme.colors.text.muted} dimColor>
          ... {suggestions.length - startIndex - MAX_VISIBLE} more below
        </Text>
      )}

      {}
      <Text color={theme.colors.text.muted} dimColor>
        ─ tab · ↑↓ · esc
      </Text>
    </Box>
  );
};

CommandSuggestions.displayName = 'CommandSuggestions';

export default CommandSuggestions;
