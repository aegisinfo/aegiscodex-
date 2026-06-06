/**
 * 
 * 
 * 
 */

import { getHookManager } from './HookManager.js';
import type { HookContext } from './types.js';
import type { PermissionMode } from '../agent/types.js';

/**
 * 
 */
function createContext(
  sessionId: string,
  projectDir?: string,
  permissionMode?: string
): HookContext {
  return {
    sessionId,
    projectDir: projectDir || process.cwd(),
    permissionMode: (permissionMode || 'default') as PermissionMode,
  };
}

/**
 * 
 */
export function isHooksAvailable(): boolean {
  const manager = getHookManager();
  return manager.isInitialized() && manager.isEnabled();
}

/**
 * 
 */
export async function onSessionStart(sessionId: string, projectDir?: string): Promise<void> {
  if (!isHooksAvailable()) return;

  try {
    await getHookManager().executeSessionStartHooks(
      createContext(sessionId, projectDir)
    );
  } catch (error) {
  }
}

/**
 * 
 */
export async function onSessionEnd(sessionId: string, projectDir?: string): Promise<void> {
  if (!isHooksAvailable()) return;

  try {
    await getHookManager().executeSessionEndHooks(
      createContext(sessionId, projectDir)
    );
  } catch (error) {
  }
}

/**
 * 
 */
export async function onUserPromptSubmit(
  promptContent: string,
  sessionId: string,
  projectDir?: string
): Promise<string | undefined> {
  if (!isHooksAvailable()) return undefined;

  try {
    const result = await getHookManager().executeUserPromptHooks(
      promptContent,
      createContext(sessionId, projectDir)
    );
    return result.injectedContext;
  } catch (error) {
    return undefined;
  }
}

/**
 */
export async function onStop(
  stopReason: string | undefined,
  sessionId: string,
  projectDir?: string
): Promise<boolean> {
  if (!isHooksAvailable()) return false;

  try {
    const result = await getHookManager().executeStopHooks(
      stopReason,
      createContext(sessionId, projectDir)
    );
    return result.shouldContinue;
  } catch (error) {
    return false;
  }
}

/**
 * 
 */
export async function onCompaction(
  preTokens: number,
  messageCount: number,
  sessionId: string,
  projectDir?: string
): Promise<boolean> {
  if (!isHooksAvailable()) return false;

  try {
    const result = await getHookManager().executeCompactionHooks(
      preTokens,
      messageCount,
      createContext(sessionId, projectDir)
    );
    return result.shouldPrevent;
  } catch (error) {
    return false;
  }
}

/**
 */
export interface PreToolHookResult {
  decision: 'allow' | 'deny' | 'ask';
  reason?: string;
  modifiedInput?: Record<string, unknown>;
  warning?: string;
}

/**
 */
export interface PostToolHookResult {
  additionalContext?: string;
  modifiedOutput?: unknown;
}

/**
 * 
 */
export async function onPreToolUse(
  toolName: string,
  toolUseId: string,
  toolInput: Record<string, unknown>,
  sessionId: string,
  projectDir?: string,
  permissionMode?: string
): Promise<PreToolHookResult> {
  if (!isHooksAvailable()) {
    return { decision: 'allow' };
  }

  try {
    return await getHookManager().executePreToolHooks(
      toolName,
      toolUseId,
      toolInput,
      createContext(sessionId, projectDir, permissionMode)
    );
  } catch (error) {
    return { decision: 'allow' };
  }
}

/**
 * 
 */
export async function onPostToolUse(
  toolName: string,
  toolUseId: string,
  toolInput: Record<string, unknown>,
  toolResult: { success: boolean; llmContent?: string },
  sessionId: string,
  projectDir?: string,
  permissionMode?: string
): Promise<PostToolHookResult> {
  if (!isHooksAvailable()) {
    return {};
  }

  try {
    return await getHookManager().executePostToolHooks(
      toolName,
      toolUseId,
      toolInput,
      toolResult,
      createContext(sessionId, projectDir, permissionMode)
    );
  } catch (error) {
    return {};
  }
}

/**
 * 
 */
export async function onPostToolUseFailure(
  toolName: string,
  toolUseId: string,
  toolInput: Record<string, unknown>,
  errorMessage: string,
  sessionId: string,
  projectDir?: string,
  permissionMode?: string
): Promise<void> {
  if (!isHooksAvailable()) return;

  try {
    await getHookManager().executePostToolFailureHooks(
      toolName,
      toolUseId,
      toolInput,
      errorMessage,
      createContext(sessionId, projectDir, permissionMode)
    );
  } catch (error) {
  }
}

/**
 * 
 * @returns 'approve' | 'deny' | 'ask'
 */
export async function onPermissionRequest(
  toolName: string,
  toolInput: Record<string, unknown>,
  sessionId: string,
  projectDir?: string,
  permissionMode?: string
): Promise<'approve' | 'deny' | 'ask'> {
  if (!isHooksAvailable()) return 'ask';

  try {
    const result = await getHookManager().executePermissionHooks(
      toolName,
      toolInput,
      createContext(sessionId, projectDir, permissionMode)
    );
    return result.decision;
  } catch (error) {
    return 'ask';
  }
}
