/**
 * Debug 日志工具
 *
 *
 */
/** 设置全局 debug 状态（由 main.tsx parseDebugEarly 调用） */
export declare function setGlobalDebug(enabled: boolean): void;
/** 获取全局 debug 状态 */
export declare function isDebugEnabled(): boolean;
/**
 *
 */
export declare function createDebugLogger(prefix: string): {
    log: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
};
export declare const agentDebug: {
    log: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
};
export declare const mcpDebug: {
    log: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
};
export declare const mcpClientDebug: (name: string) => {
    log: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
};
export declare const mcpRegistryDebug: {
    log: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
};
//# sourceMappingURL=debug.d.ts.map