/**
 * useCtrlCHandler - Ctrl+Z / Ctrl+C 处理
 *
 * Ctrl+Z 主退出键 (Kitty 中 Ctrl+C 用于复制)
 * Ctrl+C 备用退出键
 *
 * - 有任务运行时：请求中断
 * - 无任务时：退出应用
 */
interface CtrlCHandlerOptions {
    /** 中断回调 */
    onInterrupt?: () => void;
    /**
     *
     *
     */
    onBeforeExit?: () => boolean | void;
    /** 强制退出前的确认时间（毫秒） */
    forceExitDelay?: number;
}
interface CtrlCHandlerResult {
    /** 处理退出信号 (Ctrl+Z / Ctrl+C) */
    handleExit: () => void;
    /** 重置强制退出状态 */
    resetForceExit: () => void;
}
/**
 * 退出处理 Hook
 *
 * Ctrl+Z = 主退出 (Kitty 中 Ctrl+C 用于复制)
 * Ctrl+C = 备用退出
 */
export declare const useCtrlCHandler: (options: CtrlCHandlerOptions) => CtrlCHandlerResult;
export {};
//# sourceMappingURL=useCtrlCHandler.d.ts.map