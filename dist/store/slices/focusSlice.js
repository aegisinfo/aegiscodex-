/**
 * Focus Slice - 焦点状态管理
 */
const initialFocusState = {
    currentFocus: 'input',
    previousFocus: null,
};
export const createFocusSlice = (set, get) => ({
    ...initialFocusState,
    actions: {
        /**
         *
         */
        setFocus: (focus) => {
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
        pushFocus: (focus) => {
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
//# sourceMappingURL=focusSlice.js.map