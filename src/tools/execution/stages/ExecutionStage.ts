/**
 * 
 */

import type { PipelineStage, ToolExecution } from '../types.js';
import type { ExecutionContext } from '../../types.js';

export class ExecutionStage implements PipelineStage {
  readonly name = 'execution';

  async process(execution: ToolExecution): Promise<void> {
    const tool = execution._internal.tool;

    if (!tool) {
      execution.abort('Tool not found in execution context');
      return;
    }

    try {
      const context: ExecutionContext = {
        sessionId: execution.context.sessionId,
        signal: execution.context.signal,
        cwd: execution.context.workspaceRoot,
      };
      const result = await tool.execute(execution.params, context);
      execution.setResult(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      execution.abort(`Tool execution failed: ${errorMessage}`);
    }
  }
}
