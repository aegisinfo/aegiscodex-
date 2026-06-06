/**
 */

import type { StateCreator } from 'zustand';
import type { ClawdStore, FocusSlice, FocusId } from '../types.js';

const initialFocusState = {
  currentFocus: 'input' as FocusId,
  previousFocus: null as FocusId | null,
};

export const createFocusSlice: StateCreator<
  ClawdStore,
  [],
  [],
  FocusSlice
> = (set, get) => ({
  ...initialFocusState,

  actions: {
    /**
     * 
     */
    setFocus: (focus: FocusId) => {
      set((state) => ({
        focus: {
          ...state.focus,
          previousFocus: state.focus.currentFocus,
          currentFocus: focus,
        },
      }));
    },

    /**
     * 
     */
    restoreFocus: () => {
      const { previousFocus } = get().focus;
      if (previousFocus) {
        set((state) => ({
          focus: {
            ...state.focus,
            currentFocus: previousFocus,
            previousFocus: null,
          },
        }));
      }
    },

    /**
     * 
     */
    pushFocus: (focus: FocusId) => {
      set((state) => ({
        focus: {
          ...state.focus,
          previousFocus: state.focus.currentFocus,
          currentFocus: focus,
        },
      }));
    },
  },
});
