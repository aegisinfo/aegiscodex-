/**
 * InteractiveSelector - 交互式选择器组件
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { themeManager } from '../../themes/index.js';
import { FocusId, focusManager } from '../../focus/index.js';

export interface SelectorOption<T = string> {
  value: T;
  label: string;
  description?: string;
  isCurrent?: boolean;
}

interface InteractiveSelectorProps<T = string> {
  title: string;
  options: SelectorOption<T>[];
  onSelect: (value: T) => void;
  onCancel: () => void;
  initialIndex?: number;
  focusId?: string;
  maxVisible?: number;
}

export function InteractiveSelector<T = string>({
  title,
  options,
  onSelect,
  onCancel,
  initialIndex = 0,
  focusId = FocusId.SELECTOR,
  maxVisible = 10,
}: InteractiveSelectorProps<T>): React.ReactElement {
  const theme = themeManager.getTheme();
  const [selectedIndex, setSelectedIndex] = useState(() => {
    // Start at current item if one is marked
    const currentIdx = options.findIndex(o => o.isCurrent);
    return currentIdx >= 0 ? currentIdx : initialIndex;
  });
  const [scrollTop, setScrollTop] = useState(0);

  const selectFiredRef = useRef(false);
  useEffect(() => { selectFiredRef.current = false; }, [options]);

  // Keep viewport window in sync with cursor
  useEffect(() => {
    setScrollTop(prev => {
      if (selectedIndex < prev) return selectedIndex;
      if (selectedIndex >= prev + maxVisible) return selectedIndex - maxVisible + 1;
      return prev;
    });
  }, [selectedIndex, maxVisible]);

  useInput((input, key) => {
    if (focusManager.getCurrentFocus() !== focusId) return;

    if (key.upArrow || input === 'k') {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (key.pageUp) {
      setSelectedIndex(prev => Math.max(0, prev - maxVisible));
    } else if (key.pageDown) {
      setSelectedIndex(prev => Math.min(options.length - 1, prev + maxVisible));
    } else if (key.return) {
      if (!selectFiredRef.current) {
        selectFiredRef.current = true;
        onSelect(options[selectedIndex].value);
      }
    } else if (key.escape || input === 'q') {
      onCancel();
    }
  });

  useEffect(() => {
    if (selectedIndex >= options.length) setSelectedIndex(0);
  }, [options.length, selectedIndex]);

  const visibleOptions = options.slice(scrollTop, scrollTop + maxVisible);
  const hasAbove = scrollTop > 0;
  const hasBelow = scrollTop + maxVisible < options.length;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.primary}
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1} flexDirection="row" justifyContent="space-between">
        <Text bold color={theme.colors.primary}>{title}</Text>
        {options.length > maxVisible && (
          <Text color={theme.colors.text.muted} dimColor>
            {selectedIndex + 1}/{options.length}
          </Text>
        )}
      </Box>

      {hasAbove && (
        <Box>
          <Text color={theme.colors.text.muted} dimColor>  ↑ {scrollTop} more</Text>
        </Box>
      )}

      <Box flexDirection="column">
        {visibleOptions.map((option, i) => {
          const absIndex = scrollTop + i;
          const isSelected = absIndex === selectedIndex;
          return (
            <Box key={String(option.value)} flexDirection="row">
              <Text
                color={isSelected ? theme.colors.primary : theme.colors.text.primary}
                bold={isSelected}
              >
                {isSelected ? '▸ ' : '  '}
                {option.label}
                {option.isCurrent ? ' ✓' : ''}
              </Text>
              {option.description && (
                <Text color={theme.colors.text.muted} dimColor>
                  {' - '}{option.description}
                </Text>
              )}
            </Box>
          );
        })}
      </Box>

      {hasBelow && (
        <Box>
          <Text color={theme.colors.text.muted} dimColor>
            {'  ↓ '}{options.length - scrollTop - maxVisible} more
          </Text>
        </Box>
      )}

      <Box marginTop={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor={theme.colors.border.light}>
        <Text color={theme.colors.text.muted} dimColor>
          ↑/↓ navigate  PgUp/PgDn page  Enter confirm  Esc cancel
        </Text>
      </Box>
    </Box>
  );
}

export default InteractiveSelector;
