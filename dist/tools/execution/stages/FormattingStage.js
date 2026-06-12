/**
 * Formatting Stage - 结果格式化阶段
 *
 */
export class FormattingStage {
    name = 'formatting';
    async process(execution) {
        const result = execution.getResult();
        if (!result) {
            // 没有结果（可能是被中止了），不处
            return;
        }
        // 确保结果格式正
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
        // 添加执行元数
        result.metadata = {
            ...result.metadata,
            executionId: execution.context.sessionId,
            toolName: execution.toolName,
            timestamp: Date.now(),
            permissionMode: execution.context.permissionMode,
        };
        // 更新结
        execution.setResult(result);
    }
}
//# sourceMappingURL=FormattingStage.js.map