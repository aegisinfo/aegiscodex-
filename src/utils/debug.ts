/**
 * Debug 日志工具
 * 
 * 
 */

/** 设置全局 debug 状态（由 main.tsx parseDebugEarly 调用） */
export function setGlobalDebug(enabled: boolean): void {
  (globalThis as any).__AEGIS_DEBUG__ = enabled;
}

/** 获取全局 debug 状态 */
export function isDebugEnabled(): boolean {
  return (globalThis as any).__AEGIS_DEBUG__ === true;
}

/**
 * 
 */
export function createDebugLogger(prefix: string) {
  return {
    log: (...args: unknown[]) => {
      if (isDebugEnabled()) {
        console.log(`[${prefix}]`, ...args);
      }
    },
    warn: (...args: unknown[]) => {
      if (isDebugEnabled()) {
        console.warn(`[${prefix}]`, ...args);
      }
    },
    error: (...args: unknown[]) => {
      // 错误始终输
      console.error(`[${prefix}]`, ...args);
    },
  };
}

// 预定义
export const agentDebug = createDebugLogger('Agent');
export const mcpDebug = createDebugLogger('MCP');
export const mcpClientDebug = (name: string) => createDebugLogger(`McpClient:${name}`);
export const mcpRegistryDebug = createDebugLogger('McpRegistry');
