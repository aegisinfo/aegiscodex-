/**
 * 
 */

import { useState, useEffect, useCallback } from 'react';
import { focusManager, focusActions } from './FocusManager.js';
import { FocusId, type FocusState, type FocusActions } from './types.js';

/**
 * 
 */
export const useCurrentFocus = (): FocusId => {
  const [currentFocus, setCurrentFocus] = useState<FocusId>(
    focusManager.getCurrentFocus()
  );

  useEffect(() => {
    const unsubscribe = focusManager.subscribe((state) => {
      setCurrentFocus(state.currentFocus);
    });
    return unsubscribe;
  }, []);

  return currentFocus;
};

/**
 * 
 */
export const useFocusState = (): FocusState => {
  const [state, setState] = useState<FocusState>(focusManager.getState());

  useEffect(() => {
    const unsubscribe = focusManager.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  return state;
};

/**
 * 
 */
export const useFocusActions = (): FocusActions => {
  return focusActions;
};

/**
 * 
 */
export const useIsFocused = (focusId: FocusId): boolean => {
  const currentFocus = useCurrentFocus();
  return currentFocus === focusId;
};

/**
 * 
 */
export const useFocus = () => {
  const state = useFocusState();
  const actions = useFocusActions();
  
  const isFocused = useCallback(
    (id: FocusId) => state.currentFocus === id,
    [state.currentFocus]
  );

  return {
    ...state,
    ...actions,
    isFocused,
  };
};
