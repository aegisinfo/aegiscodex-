/**
 * Execution Stage - 实际执行阶段
 *
 */
export class ExecutionStage {
    name = 'execution';
    async process(execution) {
        const tool = execution._internal.tool;
        if (!tool) {
            execution.abort('Tool not found in execution context');
            return;
        }
        try {
            // 构建执行上下
            const context = {
                sessionId: execution.context.sessionId,
                signal: execution.context.signal,
                cwd: execution.context.workspaceRoot,
            };
            // 执行工
            const result = await tool.execute(execution.params, context);
            // 设置结
            execution.setResult(result);
        }
        catch (error) {
            // 处理执行错
            const errorMessage = error instanceof Error ? error.message : String(error);
            execution.abort(`Tool execution failed: ${errorMessage}`);
        }
    }
}
//# sourceMappingURL=ExecutionStage.js.map