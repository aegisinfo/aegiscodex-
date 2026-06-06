/**
 * 
 */

import type { PipelineStage, ToolExecution } from '../types.js';
import type { ToolRegistry } from '../../registry.js';

export class DiscoveryStage implements PipelineStage {
  readonly name = 'discovery';

  constructor(private registry: ToolRegistry) {}

  async process(execution: ToolExecution): Promise<void> {
    const tool = this.registry.get(execution.toolName);

    if (!tool) {
      execution.abort(`Tool "${execution.toolName}" not found in registry`);
      return;
    }
    execution._internal.tool = tool;
  }
}
