/**
 * 
 * 
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface InputBufferResult {
  
  value: string;
  
  cursorPosition: number;
  
  setValue: (newValue: string) => void;
  
  setCursorPosition: (pos: number) => void;
  
  insertAt: (text: string) => void;
  
  deleteBackward: () => void;
  
  deleteForward: () => void;
  
  clear: () => void;
  
  moveToStart: () => void;
  
  moveToEnd: () => void;
  
  getRef: () => { value: string; cursorPosition: number };
}

/**
 * 
 */
export const useInputBuffer = (
  initialValue = '',
  initialCursor = 0
): InputBufferResult => {
  const [value, setValueState] = useState(initialValue);
  const [cursorPosition, setCursorPositionState] = useState(initialCursor);
  const bufferRef = useRef({ value, cursorPosition });

  useEffect(() => {
    bufferRef.current = { value, cursorPosition };
  }, [value, cursorPosition]);

  const setValue = useCallback((newValue: string) => {
    bufferRef.current.value = newValue;
    setValueState(newValue);
    setCursorPositionState(prev => Math.min(prev, newValue.length));
  }, []);

  const setCursorPosition = useCallback((pos: number) => {
    const newPos = Math.max(0, Math.min(pos, bufferRef.current.value.length));
    bufferRef.current.cursorPosition = newPos;
    setCursorPositionState(newPos);
  }, []);

  const insertAt = useCallback((text: string) => {
    setValueState(prev => {
      const pos = bufferRef.current.cursorPosition;
      const newValue = prev.slice(0, pos) + text + prev.slice(pos);
      return newValue;
    });
    setCursorPositionState(prev => prev + text.length);
  }, []);

  const deleteBackward = useCallback(() => {
    if (bufferRef.current.cursorPosition > 0) {
      setValueState(prev => {
        const pos = bufferRef.current.cursorPosition;
        return prev.slice(0, pos - 1) + prev.slice(pos);
      });
      setCursorPositionState(prev => prev - 1);
    }
  }, []);

  const deleteForward = useCallback(() => {
    if (bufferRef.current.cursorPosition < bufferRef.current.value.length) {
      setValueState(prev => {
        const pos = bufferRef.current.cursorPosition;
        return prev.slice(0, pos) + prev.slice(pos + 1);
      });
    }
  }, []);

  const clear = useCallback(() => {
    setValueState('');
    setCursorPositionState(0);
  }, []);

  const moveToStart = useCallback(() => {
    setCursorPositionState(0);
  }, []);

  const moveToEnd = useCallback(() => {
    setCursorPositionState(bufferRef.current.value.length);
  }, []);

  const getRef = useCallback(() => bufferRef.current, []);

  return {
    value,
    cursorPosition,
    setValue,
    setCursorPosition,
    insertAt,
    deleteBackward,
    deleteForward,
    clear,
    moveToStart,
    moveToEnd,
    getRef,
  };
};
