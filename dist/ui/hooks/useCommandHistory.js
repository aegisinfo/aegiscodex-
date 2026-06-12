/**
 * useCommandHistory - 命令历史管理
 */
import { useState, useCallback } from 'react';
/**
 *
 *
 */
export const useCommandHistory = (maxHistory = 100) => {
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const addToHistory = useCallback((command) => {
        if (command.trim()) {
            setHistory(prev => {
                // 避免重复添加相同命
                if (prev[prev.length - 1] === command) {
                    return prev;
                }
                // 限制历史记录数
                const newHistory = [...prev, command];
                if (newHistory.length > maxHistory) {
                    newHistory.shift();
                }
                return newHistory;
            });
        }
        setHistoryIndex(-1);
    }, [maxHistory]);
    const getPreviousCommand = useCallback(() => {
        if (history.length === 0) {
            return null;
        }
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            return history[history.length - 1 - newIndex];
        }
        // 已经到达最早的命
        return history[0];
    }, [history, historyIndex]);
    const getNextCommand = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            return history[history.length - 1 - newIndex];
        }
        // 返回到最新（清空输
        setHistoryIndex(-1);
        return '';
    }, [history, historyIndex]);
    const resetIndex = useCallback(() => {
        setHistoryIndex(-1);
    }, []);
    return {
        addToHistory,
        getPreviousCommand,
        getNextCommand,
        resetIndex,
        history,
        historyIndex,
    };
};
//# sourceMappingURL=useCommandHistory.js.map