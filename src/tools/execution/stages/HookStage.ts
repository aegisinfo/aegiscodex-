/**
 * 
 */

import { nanoid } from 'nanoid';
import type { PipelineStage, ToolExecution } from '../types.js';
import { onPreToolUse } from '../../../hooks/index.js';

export class HookStage implements PipelineStage {
  readonly name = 'hook';

  async process(execution: ToolExecution): Promise<void> {
    const tool = execution._internal.tool;
    if (!tool) {
      return;
    }
    const toolUseId = execution.context.messageId || `tool_${nanoid()}`;
    execution._internal.hookToolUseId = toolUseId;
    const result = await onPreToolUse(
      tool.name,
      toolUseId,
      execution.params as Record<string, unknown>,
      execution.context.sessionId || 'unknown',
      execution.context.workspaceRoot || process.cwd(),
      execution.context.permissionMode
    );
    if (result.decision === 'deny') {
      execution.abort(result.reason || 'Hook blocked execution');
      return;
    }

    if (result.decision === 'ask') {
      execution._internal.needsConfirmation = true;
      execution._internal.confirmationReason =
        result.reason || 'Hook requires confirmation';
      return;
    }
    if (result.modifiedInput) {
      const newParams = { ...execution.params, ...result.modifiedInput };
      if (tool.build) {
        try {
          tool.build(newParams);
          execution.params = newParams;
        } catch (err) {
          execution.abort(
            `Hook modified parameters are invalid: ${err instanceof Error ? err.message : String(err)}`
          );
          return;
        }
      }
    }
    if (result.warning) {
    }
  }
}
