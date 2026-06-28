/**
 * Execution Stage - 实际执行阶段
 * 
 */

import type { PipelineStage, ToolExecution } from '../types.js';
import type { ExecutionContext } from '../../types.js';
import type { CacheStage } from './CacheStage.js';

export class ExecutionStage implements PipelineStage {
  readonly name = 'execution';

  constructor(private cacheStage?: CacheStage) {}

  async process(execution: ToolExecution): Promise<void> {
    // CacheStage already set the result on a cache hit — nothing to run.
    if (execution.getResult()) return;

    const tool = execution._internal.tool;

    if (!tool) {
      execution.abort('Tool not found in execution context');
      return;
    }

    try {
      // 构建执行上下
      const context: ExecutionContext = {
        sessionId: execution.context.sessionId,
        signal: execution.context.signal,
        cwd: execution.context.workspaceRoot,
      };

      // 执行工
      const result = await tool.execute(execution.params, context);

      // 设置结
      execution.setResult(result);

      const cacheKey = execution._internal.cacheKey;
      if (cacheKey) this.cacheStage?.cacheResult(cacheKey, result);
    } catch (error) {
      // 处理执行错
      const errorMessage = error instanceof Error ? error.message : String(error);
      execution.abort(`Tool execution failed: ${errorMessage}`);
    }
  }
}
