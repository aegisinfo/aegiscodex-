/**
 * useConfirmation - 确认对话框状态管理
 * 
 * 
 * 
 */

import { useState, useCallback, useMemo } from 'react';
import { focusActions, FocusId } from '../focus/index.js';
import type { ConfirmationHandler, ConfirmationDetails, ConfirmationResponse } from '../../tools/execution/types.js';

/**
 * 
 */
interface ConfirmationState {
  isVisible: boolean;
  details: ConfirmationDetails | null;
  resolver: ((response: ConfirmationResponse) => void) | null;
}

interface UseConfirmationResult {
  /** 确认状态 */
  confirmationState: ConfirmationState;
  /** 确认处理器（供 Agent/Pipeline 使用） */
  confirmationHandler: ConfirmationHandler;
  /** 处理用户响应 */
  handleResponse: (response: ConfirmationResponse) => void;
  /** 显示确认对话框 */
  showConfirmation: (details: ConfirmationDetails) => Promise<ConfirmationResponse>;
}

/**
 * 
 * 
 * 
 */
export const useConfirmation = (): UseConfirmationResult => {
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>({
    isVisible: false,
    details: null,
    resolver: null,
  });

  /**
   * 
   * 
   */
  const showConfirmation = useCallback(
    (details: ConfirmationDetails): Promise<ConfirmationResponse> => {
      return new Promise((resolve) => {
        // 同步设置焦点 — 在 React 调度 render 之前就生
        focusActions.setFocus(FocusId.CONFIRMATION_PROMPT);
        setConfirmationState({
          isVisible: true,
          details,
          resolver: resolve,
        });
      });
    },
    []
  );

  /**
   * 
   * 
   */
  const handleResponse = useCallback((response: ConfirmationResponse) => {
    if (confirmationState.resolver) {
      confirmationState.resolver(response);
    }
    // 同步恢复焦
    focusActions.setFocus(FocusId.MAIN_INPUT);
    setConfirmationState({
      isVisible: false,
      details: null,
      resolver: null,
    });
  }, [confirmationState.resolver]);

  /**
   * 
   */
  const confirmationHandler: ConfirmationHandler = useMemo(
    () => ({
      requestConfirmation: showConfirmation,
    }),
    [showConfirmation]
  );

  return {
    confirmationState,
    confirmationHandler,
    handleResponse,
    showConfirmation,
  };
};
