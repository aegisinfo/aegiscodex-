/**
 * Discovery Stage - 工具发现阶段
 *
 */
import type { PipelineStage, ToolExecution } from '../types.js';
import type { ToolRegistry } from '../../registry.js';
export declare class DiscoveryStage implements PipelineStage {
    private registry;
    readonly name = "discovery";
    constructor(registry: ToolRegistry);
    process(execution: ToolExecution): Promise<void>;
}
//# sourceMappingURL=DiscoveryStage.d.ts.map