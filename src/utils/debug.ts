/**
 * 
 * 
 */

export function setGlobalDebug(enabled: boolean): void {
  (globalThis as any).__CLAWDCODE_DEBUG__ = enabled;
}

export function isDebugEnabled(): boolean {
  return (globalThis as any).__CLAWDCODE_DEBUG__ === true;
}

/**
 * 
 */
export function createDebugLogger(prefix: string) {
  return {
    log: (...args: unknown[]) => {
      if (isDebugEnabled()) {
      }
    },
    warn: (...args: unknown[]) => {
      if (isDebugEnabled()) {
      }
    },
    error: (...args: unknown[]) => {
      console.error(`[${prefix}]`, ...args);
    },
  };
}
export const agentDebug = createDebugLogger('Agent');
export const mcpDebug = createDebugLogger('MCP');
export const mcpClientDebug = (name: string) => createDebugLogger(`McpClient:${name}`);
export const mcpRegistryDebug = createDebugLogger('McpRegistry');
