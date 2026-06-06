/**
 * 
 * 
 */

import { useCallback, useRef } from 'react';
import { useApp, useInput } from 'ink';
import { getState } from '../../store/index.js';

interface CtrlCHandlerOptions {
  
  onInterrupt?: () => void;
  /** 
   * 
   * 
   */
  onBeforeExit?: () => boolean | void;
  
  forceExitDelay?: number;
}

interface CtrlCHandlerResult {
  
  handleCtrlC: () => void;
  
  resetForceExit: () => void;
}

/**
 * 
 * 
 */
export const useCtrlCHandler = (options: CtrlCHandlerOptions): CtrlCHandlerResult => {
  const { onInterrupt, onBeforeExit, forceExitDelay = 2000 } = options;
  const { exit } = useApp();
  
  const lastCtrlCTime = useRef<number>(0);
  const forceExitPending = useRef(false);

  const doExit = useCallback(() => {
    if (onBeforeExit) {
      const handled = onBeforeExit();
      if (handled === true) {
        return;
      }
    }
    exit();
    setTimeout(() => process.exit(0), 50);
  }, [onBeforeExit, exit]);

  const handleCtrlC = useCallback(() => {
    const now = Date.now();
    const timeSinceLastCtrlC = now - lastCtrlCTime.current;
    const hasRunningTask = getState().session.isThinking;
    
    if (hasRunningTask) {
      if (forceExitPending.current && timeSinceLastCtrlC < forceExitDelay) {
        doExit();
        return;
      }
      forceExitPending.current = true;
      lastCtrlCTime.current = now;
      
      if (onInterrupt) {
        onInterrupt();
      }
    } else {
      doExit();
    }
  }, [onInterrupt, forceExitDelay, doExit]);
  useInput((input, key) => {
    if (input === 'c' && key.ctrl) {
      handleCtrlC();
    }
  });

  const resetForceExit = useCallback(() => {
    forceExitPending.current = false;
    lastCtrlCTime.current = 0;
  }, []);

  return {
    handleCtrlC,
    resetForceExit,
  };
};
