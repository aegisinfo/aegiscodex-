/**
 * Post Hook Stage - PostToolUse Hooks 执行阶段
 * 
 */

import type { PipelineStage, ToolExecution } from '../types.js';
import { onPostToolUse, onPostToolUseFailure } from '../../../hooks/index.js';

export class PostHookStage implements PipelineStage {
  readonly name = 'postHook';

  async process(execution: ToolExecution): Promise<void> {
    const result = execution.getResult();
    if (!result) {
      return;
    }

    const tool = execution._internal.tool;
    if (!tool) {
      return;
    }

    // 复用 PreToolUse 阶段生成
    const toolUseId = execution._internal.hookToolUseId || `tool_post_${Date.now()}`;
    const sessionId = execution.context.sessionId || 'unknown';
    const projectDir = execution.context.workspaceRoot || process.cwd();
    const permissionMode = execution.context.permissionMode;

    // 根据执行成
    if (result.success) {
      // 执
      const hookResult = await onPostToolUse(
        tool.name,
        toolUseId,
        execution.params as Record<string, unknown>,
        result,
        sessionId,
        projectDir,
        permissionMode
      );

      // 处理 Hook 结果：添加额外上下
      if (hookResult.additionalContext) {
        // 将 Hook 注入的上下文追加
        const currentResult = execution.getResult();
        if (currentResult) {
          currentResult.llmContent += `\n\n[Hook Context]\n${hookResult.additionalContext}`;
        }
      }

      // 处理 Hook 结果：修改输
      if (hookResult.modifiedOutput !== undefined) {
        const currentResult = execution.getResult();
        if (currentResult) {
          currentResult.llmContent = String(hookResult.modifiedOutput);
        }
      }
    } else {
      // 执
      await onPostToolUseFailure(
        tool.name,
        toolUseId,
        execution.params as Record<string, unknown>,
        result.error?.message || 'Unknown error',
        sessionId,
        projectDir,
        permissionMode
      );
    }
  }
}
