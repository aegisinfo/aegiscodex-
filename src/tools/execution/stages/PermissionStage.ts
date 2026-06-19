/**
 * Permission Stage - 权限检查阶段
 * 
 */

import { ToolKind } from '../../types.js';
import {
  PermissionMode,
  PermissionResult,
  type PipelineStage,
  type ToolExecution,
  type PermissionConfig,
  type PermissionCheckResult,
} from '../types.js';
import { PermissionChecker } from '../../validation/PermissionChecker.js';
import { SensitiveFileDetector, SensitivityLevel } from '../../validation/SensitiveFileDetector.js';
import { onPermissionRequest } from '../../../hooks/index.js';

export class PermissionStage implements PipelineStage {
  readonly name = 'permission';
  private permissionChecker: PermissionChecker;
  private defaultMode: PermissionMode;

  constructor(
    config?: Partial<PermissionConfig>,
    private sessionApprovals?: Set<string>,
    private sessionDenials?: Set<string>,
    defaultMode: PermissionMode = PermissionMode.DEFAULT
  ) {
    this.permissionChecker = new PermissionChecker(config);
    this.defaultMode = defaultMode;
  }

  async process(execution: ToolExecution): Promise<void> {
    const tool = execution._internal.tool;

    if (!tool) {
      execution.abort('Tool not found in execution context');
      return;
    }

    // 1. 创建工具调用实例（含 Zod 验
    try {
      const invocation = tool.build(execution.params);
      execution._internal.invocation = invocation;
    } catch (error) {
      execution.abort(
        `Parameter validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }

    // 2. 构建权限签
    const signature = PermissionChecker.buildSignature({
      toolName: tool.name,
      params: execution.params,
      tool,
    });
    execution._internal.permissionSignature = signature;

    // 3. 检查会话拒绝列
    if (this.sessionDenials?.has(signature)) {
      execution.abort('Permission denied (session)');
      return;
    }

    // 4. 检查会话批准列
    if (this.sessionApprovals?.has(signature)) {
      // 已在会话中批准，跳过权限检
      return;
    }

    // 5. 执行权限检
    let checkResult = this.permissionChecker.check({
      toolName: tool.name,
      params: execution.params,
      tool,
    });

    // 6. 应用权限模式覆
    const currentMode = execution.context.permissionMode || this.defaultMode;
    checkResult = this.applyModeOverrides(tool.kind, checkResult, currentMode);

    // 7. 根据结果采取行
    switch (checkResult.result) {
      case PermissionResult.DENY:
        execution.abort(checkResult.reason || 'Permission denied');
        return;

      case PermissionResult.ASK:
        // 执
        const hookDecision = await this.executePermissionHook(execution, tool.name);
        if (hookDecision === 'approve') {
          // Hook 批准，跳过确
          break;
        } else if (hookDecision === 'deny') {
          // Hook 拒
          execution.abort('Permission denied by hook');
          return;
        }
        // Hook 返回 ask 或无 hook，继续标记需要确
        execution._internal.needsConfirmation = true;
        execution._internal.confirmationReason =
          checkResult.reason || 'This operation requires confirmation';
        break;

      case PermissionResult.ALLOW:
        // 继续执
        break;
    }

    // 7. 额外安全检查：敏感文
    this.checkSensitiveFiles(execution);
  }

  /**
   * 
   */
  private applyModeOverrides(
    toolKind: ToolKind,
    checkResult: PermissionCheckResult,
    permissionMode: PermissionMode
  ): PermissionCheckResult {
    // 1. YOLO 模式：批准所有（最高优先
    if (permissionMode === PermissionMode.YOLO) {
      return {
        result: PermissionResult.ALLOW,
        matchedRule: 'mode:yolo',
        reason: 'YOLO mode: auto-approve all operations',
      };
    }

    // 2. PLAN 模式：拒绝非只读工
    if (permissionMode === PermissionMode.PLAN) {
      if (toolKind !== ToolKind.ReadOnly) {
        return {
          result: PermissionResult.DENY,
          matchedRule: 'mode:plan',
          reason: 'Plan mode: only read-only tools allowed',
        };
      }
    }

    // 3. 已被 deny 规则拒绝，不覆
    if (checkResult.result === PermissionResult.DENY) {
      return checkResult;
    }

    // 4. 已被 allow 规则批准，不覆
    if (checkResult.result === PermissionResult.ALLOW) {
      return checkResult;
    }

    // 5. 只读工具：所有模式下都批
    if (toolKind === ToolKind.ReadOnly) {
      return {
        result: PermissionResult.ALLOW,
        matchedRule: `mode:${permissionMode}:readonly`,
        reason: 'Read-only tools are auto-approved',
      };
    }

    // 6. AUTO_EDIT 模式：批准 Write 工
    if (permissionMode === PermissionMode.AUTO_EDIT && toolKind === ToolKind.Write) {
      return {
        result: PermissionResult.ALLOW,
        matchedRule: 'mode:autoEdit:write',
        reason: 'AUTO_EDIT mode: auto-approve write tools',
      };
    }

    // 7. 其他情况：保持原检查结果（通常
    return checkResult;
  }

  /**
   * 
   */
  private checkSensitiveFiles(execution: ToolExecution): void {
    const tool = execution._internal.tool;
    if (!tool) return;

    // 只检查写入相关工
    if (tool.kind === ToolKind.ReadOnly) return;

    // 获取受影响的文件路
    const affectedPaths = this.getAffectedPaths(execution);
    if (affectedPaths.length === 0) return;

    // 检查敏感文
    const sensitiveFiles = SensitiveFileDetector.filterSensitive(
      affectedPaths,
      SensitivityLevel.MEDIUM
    );

    if (sensitiveFiles.length === 0) return;

    // 高敏感文件直接拒
    const highSensitive = sensitiveFiles.filter(
      f => f.result.level === SensitivityLevel.HIGH
    );

    if (highSensitive.length > 0) {
      const files = highSensitive.map(f => f.path).join(', ');
      execution.abort(`Access to highly sensitive files denied: ${files}`);
      return;
    }

    // 中敏感文件需要确
    execution._internal.needsConfirmation = true;
    const reasons = sensitiveFiles.map(f => `${f.path}: ${f.result.reason}`);
    execution._internal.confirmationReason = `Sensitive file access detected:\n${reasons.join('\n')}`;
  }

  /**
   * 
   */
  private getAffectedPaths(execution: ToolExecution): string[] {
    const params = execution.params;

    // 从常见参数名中提取路
    const pathKeys = ['file_path', 'path', 'target', 'destination'];
    const paths: string[] = [];

    for (const key of pathKeys) {
      if (typeof params[key] === 'string') {
        paths.push(params[key] as string);
      }
    }

    return paths;
  }

  /**
   * 
   */
  private async executePermissionHook(
    execution: ToolExecution,
    toolName: string
  ): Promise<'approve' | 'deny' | 'ask'> {
    return onPermissionRequest(
      toolName,
      execution.params as Record<string, unknown>,
      execution.context.sessionId || 'unknown',
      execution.context.workspaceRoot || process.cwd(),
      execution.context.permissionMode
    );
  }
}
