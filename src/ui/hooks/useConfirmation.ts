/**
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
  
  confirmationState: ConfirmationState;
  
  confirmationHandler: ConfirmationHandler;
  
  handleResponse: (response: ConfirmationResponse) => void;
  
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
