/**
 * ExecutionPipeline - 执行管道
 *
 */
import { ToolExecution, PermissionMode, } from './types.js';
import { DiscoveryStage, PermissionStage, HookStage, ConfirmationStage, ExecutionStage, PostHookStage, FormattingStage, } from './stages/index.js';
/**
 *
 */
export class ExecutionPipeline {
    registry;
    stages;
    executionHistory = [];
    sessionApprovals = new Set();
    maxHistorySize = 1000;
    constructor(registry, config = {}) {
        this.registry = registry;
        const defaultMode = config.defaultMode || PermissionMode.DEFAULT;
        // 初始化七个执行阶
        this.stages = [
            new DiscoveryStage(this.registry),
            new PermissionStage(config.permissions, this.sessionApprovals, defaultMode),
            new HookStage(),
            new ConfirmationStage(this.sessionApprovals),
            new ExecutionStage(),
            new PostHookStage(),
            new FormattingStage(),
        ];
    }
    /**
     *
     */
    async execute(toolName, params, context) {
        const startTime = Date.now();
        const executedStages = [];
        // 创建执行实
        const execution = new ToolExecution(toolName, params, context);
        // 发出执行开始事
        try {
            // 依次执行各阶
            for (const stage of this.stages) {
                if (execution.isAborted()) {
                    break;
                }
                // 发出阶段开始事
                // 执行阶
                await stage.process(execution);
                // 记录已执行的阶
                executedStages.push(stage.name);
                // 发出阶段完成事
            }
            // 获取或创建结
            const result = execution.getResult() || this.createErrorResult(execution);
            // 记录执行历
            this.recordExecution({
                toolName,
                params,
                result,
                timestamp: startTime,
                duration: Date.now() - startTime,
                permissionMode: context.permissionMode,
                stages: executedStages,
            });
            // 发出执行完成事
            return result;
        }
        catch (error) {
            // 发出执行错误事
            const err = error instanceof Error ? error : new Error(String(error));
            // 返回错误结
            return {
                success: false,
                llmContent: `Pipeline execution error: ${err.message}`,
                displayContent: `❌ Pipeline error: ${err.message}`,
                error: {
                    type: 'execution_error',
                    message: err.message,
                },
            };
        }
    }
    /**
     *
     */
    createErrorResult(execution) {
        const reason = execution.getAbortReason() || 'Unknown error';
        return {
            success: false,
            llmContent: `Tool execution aborted: ${reason}`,
            displayContent: `❌ ${execution.toolName}: ${reason}`,
            error: {
                type: 'execution_error',
                message: reason,
            },
        };
    }
    /**
     *
     */
    recordExecution(entry) {
        this.executionHistory.push(entry);
        // 限制历史大
        if (this.executionHistory.length > this.maxHistorySize) {
            this.executionHistory.shift();
        }
    }
    /**
     *
     */
    getRegistry() {
        return this.registry;
    }
    /**
     *
     */
    getHistory() {
        return [...this.executionHistory];
    }
    /**
     *
     */
    clearHistory() {
        this.executionHistory = [];
    }
    /**
     *
     */
    getSessionApprovals() {
        return new Set(this.sessionApprovals);
    }
    /**
     *
     */
    clearSessionApprovals() {
        this.sessionApprovals.clear();
    }
    /**
     *
     */
    addSessionApproval(signature) {
        this.sessionApprovals.add(signature);
    }
    /**
     *
     */
    hasSessionApproval(signature) {
        return this.sessionApprovals.has(signature);
    }
    /**
     *
     */
    getStageNames() {
        return this.stages.map(s => s.name);
    }
}
//# sourceMappingURL=ExecutionPipeline.js.map