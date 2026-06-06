/**
 */

import { useState, useCallback } from 'react';

interface CommandHistoryResult {
  
  addToHistory: (command: string) => void;
  
  getPreviousCommand: () => string | null;
  
  getNextCommand: () => string | null;
  
  resetIndex: () => void;
  
  history: string[];
  
  historyIndex: number;
}

/**
 * 
 * 
 */
export const useCommandHistory = (maxHistory = 100): CommandHistoryResult => {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const addToHistory = useCallback((command: string) => {
    if (command.trim()) {
      setHistory(prev => {
        if (prev[prev.length - 1] === command) {
          return prev;
        }
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
    return history[0];
  }, [history, historyIndex]);

  const getNextCommand = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      return history[history.length - 1 - newIndex];
    }
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
