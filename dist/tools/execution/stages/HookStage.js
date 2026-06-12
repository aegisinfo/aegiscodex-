/**
 * Hook Stage (Pre) - PreToolUse Hooks 执行阶段
 *
 */
import { nanoid } from 'nanoid';
import { onPreToolUse } from '../../../hooks/index.js';
export class HookStage {
    name = 'hook';
    async process(execution) {
        const tool = execution._internal.tool;
        if (!tool) {
            return;
        }
        // 生成唯一的 toolUseId（PostToolUse 阶段复
        const toolUseId = execution.context.messageId || `tool_${nanoid()}`;
        execution._internal.hookToolUseId = toolUseId;
        // 执行 PreToolUse hooks（通
        const result = await onPreToolUse(tool.name, toolUseId, execution.params, execution.context.sessionId || 'unknown', execution.context.workspaceRoot || process.cwd(), execution.context.permissionMode);
        // 处理 Hook 决
        if (result.decision === 'deny') {
            // 直接拒绝，中止执
            execution.abort(result.reason || 'Hook blocked execution');
            return;
        }
        if (result.decision === 'ask') {
            // 标记需要用户确认（传递给 Confirmation 阶
            execution._internal.needsConfirmation = true;
            execution._internal.confirmationReason =
                result.reason || 'Hook requires confirmation';
            return;
        }
        // decision === 'allow'：应用修改后的输
        if (result.modifiedInput) {
            const newParams = { ...execution.params, ...result.modifiedInput };
            // 重新验证修改后的参
            if (tool.build) {
                try {
                    tool.build(newParams);
                    // 更新参
                    execution.params = newParams;
                }
                catch (err) {
                    execution.abort(`Hook modified parameters are invalid: ${err instanceof Error ? err.message : String(err)}`);
                    return;
                }
            }
        }
        // 输出警告信
        if (result.warning) {
            console.warn(`[Hook Warning] ${result.warning}`);
        }
    }
}
//# sourceMappingURL=HookStage.js.map