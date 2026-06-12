/**
 * useInputBuffer - 输入缓冲区管理
 *
 *
 */
import { useState, useCallback, useRef, useEffect } from 'react';
/**
 *
 */
export const useInputBuffer = (initialValue = '', initialCursor = 0) => {
    const [value, setValueState] = useState(initialValue);
    const [cursorPosition, setCursorPositionState] = useState(initialCursor);
    // 稳定的引用，避免 resize 时重
    const bufferRef = useRef({ value, cursorPosition });
    useEffect(() => {
        bufferRef.current = { value, cursorPosition };
    }, [value, cursorPosition]);
    const setValue = useCallback((newValue) => {
        // 立即更新 ref，避免 setCursorPosition 使用旧的长度限
        bufferRef.current.value = newValue;
        setValueState(newValue);
        // 确保光标不超出范
        setCursorPositionState(prev => Math.min(prev, newValue.length));
    }, []);
    const setCursorPosition = useCallback((pos) => {
        const newPos = Math.max(0, Math.min(pos, bufferRef.current.value.length));
        // 立即更新 ref，保持同
        bufferRef.current.cursorPosition = newPos;
        setCursorPositionState(newPos);
    }, []);
    const insertAt = useCallback((text) => {
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
//# sourceMappingURL=useInputBuffer.js.map