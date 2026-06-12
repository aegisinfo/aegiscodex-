/**
 *
 */
import { FocusId, type FocusState, type FocusActions } from './types.js';
/**
 *
 */
export declare const useCurrentFocus: () => FocusId;
/**
 *
 */
export declare const useFocusState: () => FocusState;
/**
 *
 */
export declare const useFocusActions: () => FocusActions;
/**
 *
 */
export declare const useIsFocused: (focusId: FocusId) => boolean;
/**
 *
 */
export declare const useFocus: () => {
    isFocused: (id: FocusId) => boolean;
    setFocus: (id: FocusId) => void;
    popFocus: () => void;
    resetFocus: () => void;
    pushFocus: (id: FocusId) => void;
    currentFocus: FocusId;
    previousFocus: FocusId | null;
    focusStack: FocusId[];
};
//# sourceMappingURL=useFocus.d.ts.map