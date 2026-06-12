/**
 * Discovery Stage - 工具发现阶段
 *
 */
export class DiscoveryStage {
    registry;
    name = 'discovery';
    constructor(registry) {
        this.registry = registry;
    }
    async process(execution) {
        const tool = this.registry.get(execution.toolName);
        if (!tool) {
            execution.abort(`Tool "${execution.toolName}" not found in registry`);
            return;
        }
        // 将工具实例附加到执行上下
        execution._internal.tool = tool;
    }
}
//# sourceMappingURL=DiscoveryStage.js.map