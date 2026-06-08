/**
 * Hooks 系统模块
 * 
 * 
 */

// 类型导
export * from './types.js';

// 核心类导
export { HookManager, getHookManager } from './HookManager.js';
export { HookExecutor } from './HookExecutor.js';
export { Matcher, extractFilePath, extractCommand } from './Matcher.js';

// Hook Service - 简洁 API 层（独立函
export {
  isHooksAvailable,
  // 生命周
  onSessionStart,
  onSessionEnd,
  onUserPromptSubmit,
  // 控制
  onStop,
  onCompaction,
  // 工具执
  onPreToolUse,
  onPostToolUse,
  onPostToolUseFailure,
  onPermissionRequest,
  // 类
  type PreToolHookResult,
  type PostToolHookResult,
} from './HookService.js';

// 便捷函
import { getHookManager } from './HookManager.js';
import type { HookConfig } from './types.js';

/**
 * 
 */
export function initializeHooks(config: Partial<HookConfig>): void {
  const manager = getHookManager();
  manager.loadConfig(config);
}

/**
 * 
 */
export function isHooksEnabled(): boolean {
  return getHookManager().isEnabled();
}

/**
 * 
 */
export function getHookStats(): { enabled: boolean; counts: Record<string, number> } {
  const manager = getHookManager();
  return {
    enabled: manager.isEnabled(),
    counts: manager.getHookCounts(),
  };
}
