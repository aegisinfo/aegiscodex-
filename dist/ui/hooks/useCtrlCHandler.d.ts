/**
 * useCtrlCHandler - Ctrl+C 处理
 *
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
    /** 处理 Ctrl+C */
    handleCtrlC: () => void;
    /** 重置强制退出状态 */
    resetForceExit: () => void;
}
/**
 * Ctrl+C 处理 Hook
 *
 *
 */
export declare const useCtrlCHandler: (options: CtrlCHandlerOptions) => CtrlCHandlerResult;
export {};
//# sourceMappingURL=useCtrlCHandler.d.ts.map