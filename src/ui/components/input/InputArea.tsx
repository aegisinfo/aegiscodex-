/**
 * InputArea - 输入区域组件
 * 
 * 
 * 
 */

import React, { useCallback, useState, useMemo, useEffect, useRef, memo } from 'react';
import { Box, Text, useInput } from 'ink';

// Pulsing * when processing, □ when idle
const PromptGlyph: React.FC<{ isProcessing: boolean; color: string; idleColor: string }> = memo(({ isProcessing, color, idleColor }) => {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!isProcessing) { setPulse(false); return; }
    const timer = setInterval(() => setPulse(p => !p), 500);
    return () => clearInterval(timer);
  }, [isProcessing]);
  if (!isProcessing) return <Text color={idleColor} bold>□</Text>;
  return <Text color={color} bold dimColor={pulse}>*</Text>;
});
PromptGlyph.displayName = 'PromptGlyph';
import { CustomTextInput } from './CustomTextInput.js';
import { CommandSuggestions } from './CommandSuggestions.js';

import { themeManager } from '../../themes/index.js';
import { FocusId, focusManager } from '../../focus/index.js';
import { getState, useIsThinking, usePendingCommands } from '../../../store/index.js';
import { vanillaStore } from '../../../store/vanilla.js';
import { getStreamingContent } from '../../../store/streaming-buffer.js';

// Electric blue color ramp — cycles fast to simulate voltage/energy
const ELECTRIC_COLORS = [
  '#0055FF', '#0077FF', '#0099FF', '#00AAFF',
  '#00CCFF', '#00EEFF', '#00FFFF', '#00EEFF',
  '#00CCFF', '#00AAFF', '#0099FF', '#0077FF',
];

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

    // Elapsed-time counter — increments every second while processing.
    // Only displayed after 2s to avoid flicker on fast cloud responses.
    const [thinkingSeconds, setThinkingSeconds] = useState(0);
    const [streamingTokens, setStreamingTokens] = useState(0);
    const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
      if (isProcessing) {
        setThinkingSeconds(0);
        setStreamingTokens(0);
        thinkingTimerRef.current = setInterval(() => {
          setThinkingSeconds(s => s + 1);
          const buf = getStreamingContent();
          if (buf) setStreamingTokens(Math.ceil(buf.content.length / 4));
        }, 1000);
      } else {
        if (thinkingTimerRef.current) { clearInterval(thinkingTimerRef.current); thinkingTimerRef.current = null; }
        setThinkingSeconds(0);
        setStreamingTokens(0);
      }
      return () => { if (thinkingTimerRef.current) { clearInterval(thinkingTimerRef.current); thinkingTimerRef.current = null; } };
    }, [isProcessing]);

    // Electric glow animation — fast color cycle + occasional dim flicker
    const [glowPhase, setGlowPhase] = useState(0);
    const glowTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
      if (isProcessing) {
        setGlowPhase(0);
        glowTimerRef.current = setInterval(() => setGlowPhase(p => p + 1), 100);
      } else {
        if (glowTimerRef.current) { clearInterval(glowTimerRef.current); glowTimerRef.current = null; }
        setGlowPhase(0);
      }
      return () => { if (glowTimerRef.current) { clearInterval(glowTimerRef.current); glowTimerRef.current = null; } };
    }, [isProcessing]);
    
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
    
    // 计算是否显示命令建议
    const showSuggestions = input.startsWith('/') && input.length > 0 && !isProcessing;

    // 选择建议回
    const handleSelectSuggestion = useCallback((newValue: string) => {
      handleChange(newValue);
      handleChangeCursorPosition(newValue.length);
    }, [handleChange, handleChangeCursorPosition]);

    // 清空输
    const clearInput = useCallback(() => {
      setInput('');
      setCursorPosition(0);
      inputRef.current = { value: '', cursorPosition: 0 };
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
      (_value: string) => {
        // Read from ref, not prop: the prop lags until React re-renders, so holding
        // Enter fires multiple submits with the same stale value. The ref is
        // pre-cleared here so any queued handler calls before re-render bail out.
        const current = inputRef.current.value;
        if (current.trim() && onSubmitRef.current) {
          inputRef.current = { value: '', cursorPosition: 0 }; // guard before any async
          addToHistory(current);
          clearInput(); // queues setInput('') for React
          onSubmitRef.current(current);
        }
      },
      [clearInput, addToHistory]
    );
    
    // 处理上下箭
    const handleArrowUpInternal = useCallback(() => {
      const prevCmd = getPreviousCommand();
      if (prevCmd !== null && prevCmd !== undefined) {
        handleChange(prevCmd);
        handleChangeCursorPosition(prevCmd.length);
      }
    }, [handleChange, handleChangeCursorPosition, getPreviousCommand]);
    
    const handleArrowDownInternal = useCallback(() => {
      const nextCmd = getNextCommand();
      if (nextCmd !== null && nextCmd !== undefined) {
        handleChange(nextCmd);
        handleChangeCursorPosition(nextCmd.length);
      }
    }, [handleChange, handleChangeCursorPosition, getNextCommand]);
    
    // 处理 Tab — 由 CommandSuggestions 接管
    useInput((_char, key) => {
      if (focusManager.getCurrentFocus() !== FocusId.MAIN_INPUT) return;
      // Tab is handled by CommandSuggestions; just swallow it here
      // to prevent default browser-like behavior
    });

    // 计算 thinking 状态文
    const thinkingLabel = useMemo(() => {
      if (!isProcessing) return null;
      const elapsed = thinkingSeconds >= 2 ? ` · ${thinkingSeconds}s` : '';
      const tokens = streamingTokens > 0 ? ` · ~${streamingTokens}t` : '';
      if (hasStreamingMessage) return `generating${elapsed}${tokens}`;
      return `thinking${elapsed}`;
    }, [isProcessing, hasStreamingMessage, thinkingSeconds, streamingTokens]);

    return (
      <Box flexDirection="column">
        {/* 命令建议下拉框 - 在输入框上方显示 */}
        {showSuggestions && (
          <CommandSuggestions
            input={input}
            cursorPosition={cursorPosition}
            onSelectSuggestion={handleSelectSuggestion}
            visible={showSuggestions}
          />
        )}

        {/* Thinking indicator — always occupies 1 row to prevent layout shift/flicker */}
        <Box paddingX={1} marginBottom={0} height={1}>
          {thinkingLabel ? (
            <>
              <Text
                color={ELECTRIC_COLORS[glowPhase % ELECTRIC_COLORS.length]}
                dimColor={glowPhase % 8 === 0}
              > {thinkingLabel}</Text>
              {pendingCommands.length > 0 && (
                <Text color={theme.colors.text.muted} dimColor> · queued: {pendingCommands.length}</Text>
              )}
            </>
          ) : <Text> </Text>}
        </Box>
        
        {/* 输入框 */}
        <Box
          flexDirection="row"
          paddingX={1}
          paddingY={0}
          borderStyle="single"
          borderColor={isProcessing ? theme.colors.warning : theme.colors.border.light}
        >
          {/* Pulsing * while AI works, □ when idle */}
          <Box marginRight={1}>
            <PromptGlyph
              isProcessing={isProcessing}
              color={theme.colors.warning}
              idleColor={theme.colors.primary}
            />
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
              cursorPhase={isProcessing ? glowPhase : 0}
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
