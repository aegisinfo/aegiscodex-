/**
 * useConfirmation - 确认对话框状态管理
 *
 *
 *
 */
import { useState, useCallback, useMemo } from 'react';
import { focusActions, FocusId } from '../focus/index.js';
/**
 *
 *
 *
 */
export const useConfirmation = () => {
    const [confirmationState, setConfirmationState] = useState({
        isVisible: false,
        details: null,
        resolver: null,
    });
    /**
     *
     *
     */
    const showConfirmation = useCallback((details) => {
        return new Promise((resolve) => {
            // 同步设置焦点 — 在 React 调度 render 之前就生
            focusActions.setFocus(FocusId.CONFIRMATION_PROMPT);
            setConfirmationState({
                isVisible: true,
                details,
                resolver: resolve,
            });
        });
    }, []);
    /**
     *
     *
     */
    const handleResponse = useCallback((response) => {
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
    const confirmationHandler = useMemo(() => ({
        requestConfirmation: showConfirmation,
    }), [showConfirmation]);
    return {
        confirmationState,
        confirmationHandler,
        handleResponse,
        showConfirmation,
    };
};
//# sourceMappingURL=useConfirmation.js.map