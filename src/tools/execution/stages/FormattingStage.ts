/**
 * 
 */

import type { PipelineStage, ToolExecution } from '../types.js';

export class FormattingStage implements PipelineStage {
  readonly name = 'formatting';

  async process(execution: ToolExecution): Promise<void> {
    const result = execution.getResult();

    if (!result) {
      return;
    }
    if (!result.llmContent) {
      result.llmContent = result.success
        ? 'Execution completed successfully'
        : 'Execution failed';
    }

    if (!result.displayContent) {
      result.displayContent = result.success
        ? `✅ ${execution.toolName} completed`
        : `❌ ${execution.toolName} failed`;
    }
    result.metadata = {
      ...result.metadata,
      executionId: execution.context.sessionId,
      toolName: execution.toolName,
      timestamp: Date.now(),
      permissionMode: execution.context.permissionMode,
    };
    execution.setResult(result);
  }
}
