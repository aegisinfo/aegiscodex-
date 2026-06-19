/**
 * useCtrlCHandler - Ctrl+Z / Ctrl+C 处理
 *
 * Ctrl+Z 主退出键 (Kitty 中 Ctrl+C 用于复制)
 * Ctrl+C 备用退出键
 *
 * - 有任务运行时：请求中断
 * - 无任务时：退出应用
 */
import { useCallback, useRef } from 'react';
import { useApp, useInput } from 'ink';
import { getState } from '../../store/index.js';
/**
 * 退出处理 Hook
 *
 * Ctrl+Z = 主退出 (Kitty 中 Ctrl+C 用于复制)
 * Ctrl+C = 备用退出
 */
export const useCtrlCHandler = (options) => {
    const { onInterrupt, onBeforeExit, forceExitDelay = 2000 } = options;
    const { exit } = useApp();
    const lastExitTime = useRef(0);
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
    const handleExit = useCallback(() => {
        const now = Date.now();
        const timeSinceLastExit = now - lastExitTime.current;
        const hasRunningTask = getState().session.isThinking;
        if (hasRunningTask) {
            if (forceExitPending.current && timeSinceLastExit < forceExitDelay) {
                // 第二次退出信号：强制退出
                doExit();
                return;
            }
            // 第一次退出信号：请求中断
            forceExitPending.current = true;
            lastExitTime.current = now;
            if (onInterrupt) {
                onInterrupt();
            }
        }
        else {
            // 没有任务，直接退出
            doExit();
        }
    }, [onInterrupt, forceExitDelay, doExit]);
    // Ctrl+Z = 主退出键 (Kitty-safe, Ctrl+C is copy)
    // Ctrl+C = 备用退出键
    useInput((input, key) => {
        if ((input === 'z' && key.ctrl) || (input === 'c' && key.ctrl)) {
            handleExit();
        }
    });
    const resetForceExit = useCallback(() => {
        forceExitPending.current = false;
        lastExitTime.current = 0;
    }, []);
    return {
        handleExit,
        resetForceExit,
    };
};
//# sourceMappingURL=useCtrlCHandler.js.map