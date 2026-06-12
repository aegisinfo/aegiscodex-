import React, { useMemo, useCallback, useRef, memo } from 'react';
import { Text, useInput } from 'ink';
import chalk from 'chalk';
import { useIsFocused, FocusId, focusManager } from '../../focus/index.js';

interface CustomTextInputProps {
  value: string;
  cursorPosition: number;
  /** Cursor visibility — computed by parent so this component doesn't re-render every tick */
  cursorOn?: boolean;
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

const PASTE_CONFIG = {
  TIMEOUT_MS: 100,
  RAPID_INPUT_THRESHOLD_MS: 150,
  LARGE_INPUT_THRESHOLD: 300,
};

export const CustomTextInput: React.FC<CustomTextInputProps> = memo(
  ({
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
    cursorOn = true,
  }) => {
    const isFocused = useIsFocused(focusId);
    const isActive = isFocused && !disabled;

    // Refs for all values accessed inside the stable useInput handler.
    // Updated on every render — never trigger re-renders themselves.
    const valueRef = useRef(value);
    const cursorPositionRef = useRef(cursorPosition);
    const onChangeRef = useRef(onChange);
    const onChangeCursorPositionRef = useRef(onChangeCursorPosition);
    const onSubmitRef = useRef(onSubmit);
    const onPasteRef = useRef(onPaste);
    const onArrowUpRef = useRef(onArrowUp);
    const onArrowDownRef = useRef(onArrowDown);
    const isActiveRef = useRef(isActive);

    valueRef.current = value;
    cursorPositionRef.current = cursorPosition;
    onChangeRef.current = onChange;
    onChangeCursorPositionRef.current = onChangeCursorPosition;
    onSubmitRef.current = onSubmit;
    onPasteRef.current = onPaste;
    onArrowUpRef.current = onArrowUp;
    onArrowDownRef.current = onArrowDown;
    isActiveRef.current = isActive;

    const renderedValue = useMemo(() => {
      if (!isActive) return value || chalk.dim(placeholder);

      if (value.length === 0) {
        const block = cursorOn
          ? chalk.bgHex('#1a4a38').hex('#00e5c0')(' ')
          : ' ';
        return block + chalk.dim(placeholder);
      }

      const before = value.slice(0, cursorPosition);
      const charUnder = value[cursorPosition] ?? ' ';
      const after = value.slice(cursorPosition + 1);

      const cursorChar = cursorOn
        ? chalk.bgHex('#1a4a38').hex('#00e5c0').underline(charUnder)
        : charUnder;

      return before + cursorChar + after;
    }, [value, cursorPosition, isActive, placeholder, cursorOn]);

    const pasteStateRef = useRef({
      chunks: [] as string[],
      timeoutId: null as NodeJS.Timeout | null,
      firstInputTime: null as number | null,
    });

    // Stable — accesses all mutable values via refs
    const handlePasteStable = useCallback((text: string) => {
      const val = valueRef.current;
      const pos = cursorPositionRef.current;
      if (onPasteRef.current) {
        const result = onPasteRef.current(text);
        if (result?.prompt) {
          onChangeRef.current(val + result.prompt);
          onChangeCursorPositionRef.current(val.length + result.prompt.length);
          return;
        }
      }
      const newValue = val.slice(0, pos) + text + val.slice(pos);
      onChangeRef.current(newValue);
      onChangeCursorPositionRef.current(pos + text.length);
    }, []);

    // Stable — Ink registers this once and never re-registers unless focusId changes.
    // All mutable state is read from refs at call time.
    const inputHandler = useCallback(
      (input: string, key: Parameters<Parameters<typeof useInput>[0]>[1]) => {
        if (focusManager.getCurrentFocus() !== focusId || !isActiveRef.current) return;

        const val = valueRef.current;
        const pos = cursorPositionRef.current;
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
          if (!pasteState.firstInputTime) pasteState.firstInputTime = now;
          if (pasteState.timeoutId) clearTimeout(pasteState.timeoutId);
          pasteState.timeoutId = setTimeout(() => {
            const mergedText = pasteState.chunks.join('');
            handlePasteStable(mergedText);
            pasteState.chunks = [];
            pasteState.timeoutId = null;
            pasteState.firstInputTime = null;
          }, PASTE_CONFIG.TIMEOUT_MS);
          return;
        }

        if (key.return) { onSubmitRef.current?.(val); return; }
        if (key.leftArrow) { if (pos > 0) onChangeCursorPositionRef.current(pos - 1); return; }
        if (key.rightArrow) { if (pos < val.length) onChangeCursorPositionRef.current(pos + 1); return; }
        if (key.upArrow) { onArrowUpRef.current?.(); return; }
        if (key.downArrow) { onArrowDownRef.current?.(); return; }
        if (key.backspace || key.delete) {
          if (pos > 0) {
            const newValue = val.slice(0, pos - 1) + val.slice(pos);
            onChangeRef.current(newValue);
            onChangeCursorPositionRef.current(pos - 1);
          }
          return;
        }
        if (key.ctrl && input === 'a') { onChangeCursorPositionRef.current(0); return; }
        if (key.ctrl && input === 'e') { onChangeCursorPositionRef.current(val.length); return; }
        if (key.ctrl && input === 'k') { onChangeRef.current(val.slice(0, pos)); return; }
        if (key.ctrl && input === 'u') {
          onChangeRef.current(val.slice(pos));
          onChangeCursorPositionRef.current(0);
          return;
        }
        if (input && !key.ctrl && !key.meta) {
          const newValue = val.slice(0, pos) + input + val.slice(pos);
          onChangeRef.current(newValue);
          onChangeCursorPositionRef.current(pos + input.length);
        }
      },
      [focusId, handlePasteStable] // both stable — focusId is a constant, handlePasteStable has empty deps
    );

    useInput(inputHandler, { isActive });

    return (
      <Text>
        {!isActive && value.length === 0 ? (
          <Text dimColor>{placeholder}</Text>
        ) : (
          renderedValue
        )}
      </Text>
    );
  },
  // Only re-render when the displayed output would actually change.
  // Callbacks are accessed via refs so they never need to cause a re-render.
  // focus changes trigger re-renders via useIsFocused internally (bypasses this comparator).
  (prev, next) =>
    prev.value === next.value &&
    prev.cursorPosition === next.cursorPosition &&
    prev.cursorOn === next.cursorOn &&
    prev.placeholder === next.placeholder &&
    prev.disabled === next.disabled &&
    prev.focusId === next.focusId
);

CustomTextInput.displayName = 'CustomTextInput';

export default CustomTextInput;
