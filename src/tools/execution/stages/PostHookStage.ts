/**
 * 
 */

import type { PipelineStage, ToolExecution } from '../types.js';
import { onPostToolUse, onPostToolUseFailure } from '../../../hooks/index.js';

export class PostHookStage implements PipelineStage {
  readonly name = 'postHook';

  async process(execution: ToolExecution): Promise<void> {
    const result = execution.getResult();
    if (!result) {
      return;
    }

    const tool = execution._internal.tool;
    if (!tool) {
      return;
    }
    const toolUseId = execution._internal.hookToolUseId || `tool_post_${Date.now()}`;
    const sessionId = execution.context.sessionId || 'unknown';
    const projectDir = execution.context.workspaceRoot || process.cwd();
    const permissionMode = execution.context.permissionMode;
    if (result.success) {
      const hookResult = await onPostToolUse(
        tool.name,
        toolUseId,
        execution.params as Record<string, unknown>,
        result,
        sessionId,
        projectDir,
        permissionMode
      );
      if (hookResult.additionalContext) {
        const currentResult = execution.getResult();
        if (currentResult) {
          currentResult.llmContent += `\n\n[Hook Context]\n${hookResult.additionalContext}`;
        }
      }
      if (hookResult.modifiedOutput !== undefined) {
        const currentResult = execution.getResult();
        if (currentResult) {
          currentResult.llmContent = String(hookResult.modifiedOutput);
        }
      }
    } else {
      await onPostToolUseFailure(
        tool.name,
        toolUseId,
        execution.params as Record<string, unknown>,
        result.error?.message || 'Unknown error',
        sessionId,
        projectDir,
        permissionMode
      );
    }
  }
}
