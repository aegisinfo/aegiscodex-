/**
 * Discovery Stage - 工具发现阶段
 * 
 * Per-model allowedTools/disallowedTools filtering added here.
 */

import type { PipelineStage, ToolExecution } from '../types.js';
import type { ToolRegistry } from '../../registry.js';

export class DiscoveryStage implements PipelineStage {
  readonly name = 'discovery';

  constructor(
    private registry: ToolRegistry,
    private allowedTools?: string[],
    private disallowedTools?: string[],
  ) {}

  async process(execution: ToolExecution): Promise<void> {
    // 1. Check per-model disallowed tools
    if (this.disallowedTools?.includes(execution.toolName)) {
      execution.abort(`Tool "${execution.toolName}" is disallowed for the current model`);
      return;
    }

    // 2. Check per-model allowed tools (if set, only these are allowed)
    if (this.allowedTools && this.allowedTools.length > 0) {
      if (!this.allowedTools.includes(execution.toolName)) {
        execution.abort(
          `Tool "${execution.toolName}" is not in the allowed tools list for the current model`
        );
        return;
      }
    }

    const tool = this.registry.get(execution.toolName);

    if (!tool) {
      execution.abort(`Tool "${execution.toolName}" not found in registry`);
      return;
    }

    // 将工具实例附加到执行上下
    execution._internal.tool = tool;
  }
}
