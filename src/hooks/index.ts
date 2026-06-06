/**
 * 
 * 
 */
export * from './types.js';
export { HookManager, getHookManager } from './HookManager.js';
export { HookExecutor } from './HookExecutor.js';
export { Matcher, extractFilePath, extractCommand } from './Matcher.js';
export {
  isHooksAvailable,
  onSessionStart,
  onSessionEnd,
  onUserPromptSubmit,
  onStop,
  onCompaction,
  onPreToolUse,
  onPostToolUse,
  onPostToolUseFailure,
  onPermissionRequest,
  type PreToolHookResult,
  type PostToolHookResult,
} from './HookService.js';
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
