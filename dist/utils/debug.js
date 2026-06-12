/**
 * Debug 日志工具
 *
 *
 */
/** 设置全局 debug 状态（由 main.tsx parseDebugEarly 调用） */
export function setGlobalDebug(enabled) {
    globalThis.__AEGIS_DEBUG__ = enabled;
}
/** 获取全局 debug 状态 */
export function isDebugEnabled() {
    return globalThis.__AEGIS_DEBUG__ === true;
}
/**
 *
 */
export function createDebugLogger(prefix) {
    return {
        log: (...args) => {
            if (isDebugEnabled()) {
                console.log(`[${prefix}]`, ...args);
            }
        },
        warn: (...args) => {
            if (isDebugEnabled()) {
                console.warn(`[${prefix}]`, ...args);
            }
        },
        error: (...args) => {
            // 错误始终输
            console.error(`[${prefix}]`, ...args);
        },
    };
}
// 预定义
export const agentDebug = createDebugLogger('Agent');
export const mcpDebug = createDebugLogger('MCP');
export const mcpClientDebug = (name) => createDebugLogger(`McpClient:${name}`);
export const mcpRegistryDebug = createDebugLogger('McpRegistry');
//# sourceMappingURL=debug.js.map