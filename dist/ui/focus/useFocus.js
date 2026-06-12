/**
 *
 */
import { useState, useEffect, useCallback } from 'react';
import { focusManager, focusActions } from './FocusManager.js';
/**
 *
 */
export const useCurrentFocus = () => {
    const [currentFocus, setCurrentFocus] = useState(focusManager.getCurrentFocus());
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
export const useFocusState = () => {
    const [state, setState] = useState(focusManager.getState());
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
export const useFocusActions = () => {
    return focusActions;
};
/**
 *
 */
export const useIsFocused = (focusId) => {
    const currentFocus = useCurrentFocus();
    return currentFocus === focusId;
};
/**
 *
 */
export const useFocus = () => {
    const state = useFocusState();
    const actions = useFocusActions();
    const isFocused = useCallback((id) => state.currentFocus === id, [state.currentFocus]);
    return {
        ...state,
        ...actions,
        isFocused,
    };
};
//# sourceMappingURL=useFocus.js.map