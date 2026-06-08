/**
 * 
 * 
 * 
 */

import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { CustomTextInput } from './CustomTextInput.js';
import { CommandSuggestions } from './CommandSuggestions.js';
import { themeManager } from '../../themes/index.js';
import { FocusId, focusManager } from '../../focus/index.js';
import { getCommandCompletions } from '../../../slash-commands/index.js';
import { getState, useIsThinking, usePendingCommands } from '../../../store/index.js';
import { vanillaStore } from '../../../store/vanilla.js';
import type { CommandSuggestion } from '../../../slash-commands/types.js';

interface InputAreaProps {
  
  onSubmit?: (value: string) => void;
}

/**
 * 
 * 
 */
export const InputArea: React.FC<InputAreaProps> = React.memo(
  ({
    onSubmit,
  }) => {
    const onSubmitRef = useRef(onSubmit);
    useEffect(() => {
      onSubmitRef.current = onSubmit;
    });
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);
    
    const addToHistory = useCallback((command: string) => {
      if (command.trim()) {
        const history = historyRef.current;
        if (history[history.length - 1] !== command) {
          history.push(command);
          if (history.length > 100) history.shift();
        }
      }
      historyIndexRef.current = -1;
    }, []);
    
    const getPreviousCommand = useCallback(() => {
      const history = historyRef.current;
      if (history.length === 0) return null;
      if (historyIndexRef.current < history.length - 1) {
        historyIndexRef.current++;
        return history[history.length - 1 - historyIndexRef.current];
      }
      return history[0];
    }, []);
    
    const getNextCommand = useCallback(() => {
      if (historyIndexRef.current > 0) {
        historyIndexRef.current--;
        return historyRef.current[historyRef.current.length - 1 - historyIndexRef.current];
      }
      historyIndexRef.current = -1;
      return '';
    }, []);
    
    const theme = themeManager.getTheme();
    const isProcessing = useIsThinking();
    const pendingCommands = usePendingCommands();
    
    // hasStreamingMessage via store subscription to avoid re-render on every delta
    const [hasStreamingMessage, setHasStreamingMessage] = useState(
      () => getState().session.messages.some(m => m.isStreaming)
    );
    useEffect(() => {
      let prev = hasStreamingMessage;
      const unsubscribe = vanillaStore.subscribe((state) => {
        const newVal = state.session.messages.some(m => m.isStreaming);
        if (newVal !== prev) {
          prev = newVal;
          setHasStreamingMessage(newVal);
        }
      });
      return unsubscribe;
    }, []);
    const placeholder = useMemo(() => {
      if (isProcessing) {
        return pendingCommands.length > 0
          ? `Queued: ${pendingCommands.length} command(s). Type to add more...`
          : 'Processing... Type to queue next command';
      }
      return 'Type a message... (Ctrl+C to exit)';
    }, [isProcessing, pendingCommands.length]);
    const [input, setInput] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const inputRef = useRef({ value: '', cursorPosition: 0 });
    useEffect(() => {
      inputRef.current = { value: input, cursorPosition };
    }, [input, cursorPosition]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const handleChange = useCallback((newValue: string) => {
      inputRef.current.value = newValue;
      setInput(newValue);
      setCursorPosition(prev => Math.min(prev, newValue.length));
    }, []);
    const handleChangeCursorPosition = useCallback((pos: number) => {
      const newPos = Math.max(0, Math.min(pos, inputRef.current.value.length));
      inputRef.current.cursorPosition = newPos;
      setCursorPosition(newPos);
    }, []);
    const clearInput = useCallback(() => {
      setInput('');
      setCursorPosition(0);
      inputRef.current = { value: '', cursorPosition: 0 };
    }, []);
    const suggestions = useMemo<CommandSuggestion[]>(() => {
      if (!input.startsWith('/')) {
        return [];
      }
      if (input.includes(' ')) {
        return [];
      }
      
      return getCommandCompletions(input);
    }, [input]);
    useEffect(() => {
      setSelectedIndex(0);
      setShowSuggestions(suggestions.length > 0);
    }, [suggestions]);
    const suggestionsRef = useRef(suggestions);
    suggestionsRef.current = suggestions;
    const selectedIndexRef = useRef(selectedIndex);
    selectedIndexRef.current = selectedIndex;

    const handleTabComplete = useCallback(() => {
      if (suggestionsLenRef.current > 0 && showSuggestionsRef.current) {
        const selected = suggestionsRef.current[selectedIndexRef.current];
        if (selected) {
          const newValue = selected.command + ' ';
          handleChange(newValue);
          handleChangeCursorPosition(newValue.length);
          setShowSuggestions(false);
        }
      }
    }, [handleChange, handleChangeCursorPosition]);
    const handleSelectPrev = useCallback(() => {
      if (showSuggestions && suggestions.length > 0) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        return true;
      }
      return false;
    }, [showSuggestions, suggestions.length]);
    const handleSelectNext = useCallback(() => {
      if (showSuggestions && suggestions.length > 0) {
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        return true;
      }
      return false;
    }, [showSuggestions, suggestions.length]);
    const handleCloseSuggestions = useCallback(() => {
      setShowSuggestions(false);
    }, []);
    const handlePaste = useCallback((text: string) => {
      const lineCount = text.split('\n').length;
      const charCount = text.length;

      if (charCount > 500 || lineCount > 10) {
        const preview = text.slice(0, 30).replace(/\n/g, ' ');
        return { prompt: `[Pasted: ${charCount} chars, ${lineCount} lines] ${preview}...` };
      }
      return {};
    }, []);
    const showSuggestionsRef = useRef(showSuggestions);
    showSuggestionsRef.current = showSuggestions;
    const suggestionsLenRef = useRef(suggestions.length);
    suggestionsLenRef.current = suggestions.length;

    const handleSubmit = useCallback(
      (value: string) => {
        if (showSuggestionsRef.current && suggestionsLenRef.current > 0) {
          handleTabComplete();
          return;
        }
        
        if (value.trim() && onSubmitRef.current) {
          addToHistory(value);
          onSubmitRef.current(value);
          clearInput();
          setShowSuggestions(false);
        }
      },
      [handleTabComplete, clearInput, addToHistory]
    );
    const handleArrowUpInternal = useCallback(() => {
      if (handleSelectPrev()) {
        return;
      }
      const prevCmd = getPreviousCommand();
      if (prevCmd !== null && prevCmd !== undefined) {
        handleChange(prevCmd);
        handleChangeCursorPosition(prevCmd.length);
      }
    }, [handleSelectPrev, handleChange, handleChangeCursorPosition, getPreviousCommand]);
    
    const handleArrowDownInternal = useCallback(() => {
      if (handleSelectNext()) {
        return;
      }
      const nextCmd = getNextCommand();
      if (nextCmd !== null && nextCmd !== undefined) {
        handleChange(nextCmd);
        handleChangeCursorPosition(nextCmd.length);
      }
    }, [handleSelectNext, handleChange, handleChangeCursorPosition, getNextCommand]);
    useInput((char, key) => {
      // Imperative focus check — avoids stale React closure
      if (focusManager.getCurrentFocus() !== FocusId.MAIN_INPUT) return;
      if (key.tab) {
        handleTabComplete();
      } else if (key.escape) {
        handleCloseSuggestions();
      }
    });
    const thinkingLabel = useMemo(() => {
      if (!isProcessing) return null;
      if (hasStreamingMessage) return 'Generating...';
      return 'Thinking...';
    }, [isProcessing, hasStreamingMessage]);

    return (
      <Box flexDirection="column">
        {}
        <CommandSuggestions
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          visible={showSuggestions}
        />
        
        {}
        {thinkingLabel && (
          <Box paddingX={1} marginBottom={0}>
            <Text color={theme.colors.warning}>
              <Spinner type="dots" />
            </Text>
            <Text color={theme.colors.warning}> {thinkingLabel}</Text>
            {pendingCommands.length > 0 && (
              <Text color={theme.colors.text.muted}> · queued: {pendingCommands.length}</Text>
            )}
          </Box>
        )}
        
        {}
        <Box
          flexDirection="row"
          paddingX={1}
          paddingY={0}
          borderStyle="round"
          borderColor={isProcessing ? theme.colors.warning : theme.colors.border.light}
        >
          {}
          <Box marginRight={1}>
            <Text color={theme.colors.success} bold>
              {isProcessing ? '⏳' : '>'}
            </Text>
          </Box>

          {}
          <Box flexGrow={1}>
            <CustomTextInput
              value={input}
              cursorPosition={cursorPosition}
              onChange={handleChange}
              onChangeCursorPosition={handleChangeCursorPosition}
              onSubmit={handleSubmit}
              onPaste={handlePaste}
              onArrowUp={handleArrowUpInternal}
              onArrowDown={handleArrowDownInternal}
              placeholder={placeholder}
              focusId={FocusId.MAIN_INPUT}
              disabled={false}
            />
          </Box>
        </Box>
      </Box>
    );
  },
  () => false
);

InputArea.displayName = 'InputArea';

export default InputArea;
