/**
 * 
 * 
 */

import React, { useMemo, useCallback } from 'react';
import { Text, useInput } from 'ink';
import chalk from 'chalk';
import { useIsFocused, FocusId, focusManager } from '../../focus/index.js';

interface CustomTextInputProps {
  
  value: string;
  
  cursorPosition: number;
  
  onChange: (value: string) => void;
  
  onChangeCursorPosition: (pos: number) => void;
  
  onSubmit?: (value: string) => void;
  
  onPaste?: (text: string) => { prompt?: string } | void;
  
  onArrowUp?: () => void;
  
  onArrowDown?: () => void;
  
  placeholder?: string;
  
  focusId?: FocusId;
  
  disabled?: boolean;
}

/**
 * 
 */
const PASTE_CONFIG = {
  TIMEOUT_MS: 100,
  RAPID_INPUT_THRESHOLD_MS: 150,
  LARGE_INPUT_THRESHOLD: 300,
};

/**
 * 
 */
export const CustomTextInput: React.FC<CustomTextInputProps> = ({
  value,
  cursorPosition,
  onChange,
  onChangeCursorPosition,
  onSubmit,
  onPaste,
  onArrowUp,
  onArrowDown,
  placeholder = '',
  focusId = FocusId.MAIN_INPUT,
  disabled = false,
}) => {
  const isFocused = useIsFocused(focusId);
  const isActive = isFocused && !disabled;
  const renderedValue = useMemo(() => {
    if (!isActive) {
      return value || placeholder;
    }

    if (value.length === 0) {
      return chalk.inverse(' ') + chalk.dim(placeholder);
    }

    const before = value.slice(0, cursorPosition);
    const cursorChar = value[cursorPosition] || ' ';
    const after = value.slice(cursorPosition + 1);

    return `${before}${chalk.inverse(cursorChar)}${after}`;
  }, [value, cursorPosition, isActive, placeholder]);
  const pasteStateRef = React.useRef({
    chunks: [] as string[],
    timeoutId: null as NodeJS.Timeout | null,
    firstInputTime: null as number | null,
  });
  const handlePaste = useCallback(
    (text: string) => {
      if (onPaste) {
        const result = onPaste(text);
        if (result?.prompt) {
          onChange(value + result.prompt);
          onChangeCursorPosition(value.length + result.prompt.length);
          return;
        }
      }
      const newValue = value.slice(0, cursorPosition) + text + value.slice(cursorPosition);
      onChange(newValue);
      onChangeCursorPosition(cursorPosition + text.length);
    },
    [value, cursorPosition, onChange, onChangeCursorPosition, onPaste]
  );
  useInput(
    (input, key) => {
      // Imperative focus check — avoids stale React closure
      if (focusManager.getCurrentFocus() !== focusId || disabled) return;
      if (!isActive) return;

      const now = Date.now();
      const pasteState = pasteStateRef.current;
      const timeSinceFirst = pasteState.firstInputTime
        ? now - pasteState.firstInputTime
        : 0;
      const isPaste =
        input.length > PASTE_CONFIG.LARGE_INPUT_THRESHOLD ||
        input.includes('\n') ||
        (timeSinceFirst < PASTE_CONFIG.RAPID_INPUT_THRESHOLD_MS &&
          pasteState.chunks.length > 0);

      if (isPaste && input.length > 1) {
        pasteState.chunks.push(input);
        if (!pasteState.firstInputTime) {
          pasteState.firstInputTime = now;
        }
        if (pasteState.timeoutId) {
          clearTimeout(pasteState.timeoutId);
        }

        pasteState.timeoutId = setTimeout(() => {
          const mergedText = pasteState.chunks.join('');
          handlePaste(mergedText);
          pasteState.chunks = [];
          pasteState.timeoutId = null;
          pasteState.firstInputTime = null;
        }, PASTE_CONFIG.TIMEOUT_MS);

        return;
      }
      if (key.return) {
        onSubmit?.(value);
        return;
      }

      if (key.leftArrow) {
        if (cursorPosition > 0) {
          onChangeCursorPosition(cursorPosition - 1);
        }
        return;
      }

      if (key.rightArrow) {
        if (cursorPosition < value.length) {
          onChangeCursorPosition(cursorPosition + 1);
        }
        return;
      }
      if (key.upArrow) {
        onArrowUp?.();
        return;
      }
      if (key.downArrow) {
        onArrowDown?.();
        return;
      }

      if (key.backspace || key.delete) {
        if (cursorPosition > 0) {
          const newValue = value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
          onChange(newValue);
          onChangeCursorPosition(cursorPosition - 1);
        }
        return;
      }
      if (key.ctrl && input === 'a') {
        onChangeCursorPosition(0);
        return;
      }
      if (key.ctrl && input === 'e') {
        onChangeCursorPosition(value.length);
        return;
      }
      if (key.ctrl && input === 'k') {
        onChange(value.slice(0, cursorPosition));
        return;
      }
      if (key.ctrl && input === 'u') {
        onChange(value.slice(cursorPosition));
        onChangeCursorPosition(0);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        const newValue = value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
        onChange(newValue);
        onChangeCursorPosition(cursorPosition + input.length);
      }
    },
    { isActive }
  );

  return (
    <Text>
      {!isActive && value.length === 0 ? (
        <Text dimColor>{placeholder}</Text>
      ) : (
        renderedValue
      )}
    </Text>
  );
};

export default CustomTextInput;
