/**
 * InputArea - 输入区域组件
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
  /** 提交回调 */
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
    // 使用 ref 保持回调引用稳
    const onSubmitRef = useRef(onSubmit);
    
    // 更新 ref（不触发重新渲
    useEffect(() => {
      onSubmitRef.current = onSubmit;
    });
    
    // 自管理命令历史（使用 ref 避免状态变化导致重新渲染传播到父组
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
    
    // 自己订阅需要的状
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
    
    // 计
    const placeholder = useMemo(() => {
      if (isProcessing) {
        return pendingCommands.length > 0
          ? `Queued: ${pendingCommands.length} command(s). Type to add more...`
          : 'Processing... Type to queue next command';
      }
      return 'Type a message... (Ctrl+C to exit)';
    }, [isProcessing, pendingCommands.length]);
    
    // 自管理的输入状
    const [input, setInput] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const inputRef = useRef({ value: '', cursorPosition: 0 });
    
    // 更新 ref 保持同
    useEffect(() => {
      inputRef.current = { value: input, cursorPosition };
    }, [input, cursorPosition]);
    
    // 补全状
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    
    // 设置输入
    const handleChange = useCallback((newValue: string) => {
      inputRef.current.value = newValue;
      setInput(newValue);
      setCursorPosition(prev => Math.min(prev, newValue.length));
    }, []);
    
    // 设置光标位
    const handleChangeCursorPosition = useCallback((pos: number) => {
      const newPos = Math.max(0, Math.min(pos, inputRef.current.value.length));
      inputRef.current.cursorPosition = newPos;
      setCursorPosition(newPos);
    }, []);
    
    // 清空输
    const clearInput = useCallback(() => {
      setInput('');
      setCursorPosition(0);
      inputRef.current = { value: '', cursorPosition: 0 };
    }, []);
    
    // 计算命令建
    const suggestions = useMemo<CommandSuggestion[]>(() => {
      // 只有输
      if (!input.startsWith('/')) {
        return [];
      }
      
      // 如果输入中有空格，说明已经是完整命令+参数
      if (input.includes(' ')) {
        return [];
      }
      
      return getCommandCompletions(input);
    }, [input]);
    
    // 当建议变化时，重置选中索
    useEffect(() => {
      setSelectedIndex(0);
      setShowSuggestions(suggestions.length > 0);
    }, [suggestions]);
    
    // 处理 Tab 补
    const handleTabComplete = useCallback(() => {
      if (suggestions.length > 0 && showSuggestions) {
        const selected = suggestions[selectedIndex];
        if (selected) {
          // 补全命令（保留可能的空格给参
          const newValue = selected.command + ' ';
          handleChange(newValue);
          handleChangeCursorPosition(newValue.length);
          setShowSuggestions(false);
        }
      }
    }, [suggestions, selectedIndex, showSuggestions, handleChange, handleChangeCursorPosition]);
    
    // 处理选择上一个建
    const handleSelectPrev = useCallback(() => {
      if (showSuggestions && suggestions.length > 0) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        return true;
      }
      return false;
    }, [showSuggestions, suggestions.length]);
    
    // 处理选择下一个建
    const handleSelectNext = useCallback(() => {
      if (showSuggestions && suggestions.length > 0) {
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        return true;
      }
      return false;
    }, [showSuggestions, suggestions.length]);
    
    // 处理关闭建
    const handleCloseSuggestions = useCallback(() => {
      setShowSuggestions(false);
    }, []);

    // 大段文本粘贴处
    const handlePaste = useCallback((text: string) => {
      const lineCount = text.split('\n').length;
      const charCount = text.length;

      if (charCount > 500 || lineCount > 10) {
        const preview = text.slice(0, 30).replace(/\n/g, ' ');
        return { prompt: `[Pasted: ${charCount} chars, ${lineCount} lines] ${preview}...` };
      }
      return {};
    }, []);

    // 提交处
    const handleSubmit = useCallback(
      (value: string) => {
        // 如果有建议显示且按回车，先补
        if (showSuggestions && suggestions.length > 0) {
          handleTabComplete();
          return;
        }
        
        if (value.trim() && onSubmitRef.current) {
          addToHistory(value); // 添加到内部历
          onSubmitRef.current(value);
          clearInput();
          setShowSuggestions(false);
        }
      },
      [showSuggestions, suggestions.length, handleTabComplete, clearInput, addToHistory]
    );
    
    // 处理上下箭
    const handleArrowUpInternal = useCallback(() => {
      // 如果有建议显示，用于选择建
      if (handleSelectPrev()) {
        return;
      }
      // 否则用于浏览历史（使用内部管理的历
      const prevCmd = getPreviousCommand();
      if (prevCmd !== null && prevCmd !== undefined) {
        handleChange(prevCmd);
        handleChangeCursorPosition(prevCmd.length);
      }
    }, [handleSelectPrev, handleChange, handleChangeCursorPosition, getPreviousCommand]);
    
    const handleArrowDownInternal = useCallback(() => {
      // 如果有建议显示，用于选择建
      if (handleSelectNext()) {
        return;
      }
      // 否则用于浏览历史（使用内部管理的历
      const nextCmd = getNextCommand();
      if (nextCmd !== null && nextCmd !== undefined) {
        handleChange(nextCmd);
        handleChangeCursorPosition(nextCmd.length);
      }
    }, [handleSelectNext, handleChange, handleChangeCursorPosition, getNextCommand]);
    
    // 处理 Tab 和 Escape 
    useInput((char, key) => {
      // Imperative focus check — avoids stale React closure
      if (focusManager.getCurrentFocus() !== FocusId.MAIN_INPUT) return;
      if (key.tab) {
        handleTabComplete();
      } else if (key.escape) {
        handleCloseSuggestions();
      }
    });

    // 计算 thinking 状态文
    const thinkingLabel = useMemo(() => {
      if (!isProcessing) return null;
      if (hasStreamingMessage) return 'Generating...';
      return 'Thinking...';
    }, [isProcessing, hasStreamingMessage]);

    return (
      <Box flexDirection="column">
        {/* 命令补全建议 */}
        <CommandSuggestions
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          visible={showSuggestions}
        />
        
        {/* 思考/生成状态指示器 - 紧贴输入框上方 */}
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
        
        {/* 输入框 */}
        <Box
          flexDirection="row"
          paddingX={1}
          paddingY={0}
          borderStyle="round"
          borderColor={isProcessing ? theme.colors.warning : theme.colors.border.light}
        >
          {/* 提示符 */}
          <Box marginRight={1}>
            <Text color={theme.colors.success} bold>
              {isProcessing ? '⏳' : '>'}
            </Text>
          </Box>

          {/* 输入框 - 始终启用，支持命令队列 */}
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
  // 自定义比较函数：始终返回 true，因为回调通过 ref 访
  // 这样 props 变化不会触发重新渲
  () => false
);

InputArea.displayName = 'InputArea';

export default InputArea;
