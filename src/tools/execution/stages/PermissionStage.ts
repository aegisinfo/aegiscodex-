/**
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
    try {
      const invocation = tool.build(execution.params);
      execution._internal.invocation = invocation;
    } catch (error) {
      execution.abort(
        `Parameter validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }
    const signature = PermissionChecker.buildSignature({
      toolName: tool.name,
      params: execution.params,
      tool,
    });
    execution._internal.permissionSignature = signature;
    if (this.sessionApprovals?.has(signature)) {
      return;
    }
    let checkResult = this.permissionChecker.check({
      toolName: tool.name,
      params: execution.params,
      tool,
    });
    const currentMode = execution.context.permissionMode || this.defaultMode;
    checkResult = this.applyModeOverrides(tool.kind, checkResult, currentMode);
    switch (checkResult.result) {
      case PermissionResult.DENY:
        execution.abort(checkResult.reason || 'Permission denied');
        return;

      case PermissionResult.ASK:
        const hookDecision = await this.executePermissionHook(execution, tool.name);
        if (hookDecision === 'approve') {
          break;
        } else if (hookDecision === 'deny') {
          execution.abort('Permission denied by hook');
          return;
        }
        execution._internal.needsConfirmation = true;
        execution._internal.confirmationReason =
          checkResult.reason || 'This operation requires confirmation';
        break;

      case PermissionResult.ALLOW:
        break;
    }
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
    if (permissionMode === PermissionMode.YOLO) {
      return {
        result: PermissionResult.ALLOW,
        matchedRule: 'mode:yolo',
        reason: 'YOLO mode: auto-approve all operations',
      };
    }
    if (permissionMode === PermissionMode.PLAN) {
      if (toolKind !== ToolKind.ReadOnly) {
        return {
          result: PermissionResult.DENY,
          matchedRule: 'mode:plan',
          reason: 'Plan mode: only read-only tools allowed',
        };
      }
    }
    if (checkResult.result === PermissionResult.DENY) {
      return checkResult;
    }
    if (checkResult.result === PermissionResult.ALLOW) {
      return checkResult;
    }
    if (toolKind === ToolKind.ReadOnly) {
      return {
        result: PermissionResult.ALLOW,
        matchedRule: `mode:${permissionMode}:readonly`,
        reason: 'Read-only tools are auto-approved',
      };
    }
    if (permissionMode === PermissionMode.AUTO_EDIT && toolKind === ToolKind.Write) {
      return {
        result: PermissionResult.ALLOW,
        matchedRule: 'mode:autoEdit:write',
        reason: 'AUTO_EDIT mode: auto-approve write tools',
      };
    }
    return checkResult;
  }

  /**
   * 
   */
  private checkSensitiveFiles(execution: ToolExecution): void {
    const tool = execution._internal.tool;
    if (!tool) return;
    if (tool.kind === ToolKind.ReadOnly) return;
    const affectedPaths = this.getAffectedPaths(execution);
    if (affectedPaths.length === 0) return;
    const sensitiveFiles = SensitiveFileDetector.filterSensitive(
      affectedPaths,
      SensitivityLevel.MEDIUM
    );

    if (sensitiveFiles.length === 0) return;
    const highSensitive = sensitiveFiles.filter(
      f => f.result.level === SensitivityLevel.HIGH
    );

    if (highSensitive.length > 0) {
      const files = highSensitive.map(f => f.path).join(', ');
      execution.abort(`Access to highly sensitive files denied: ${files}`);
      return;
    }
    execution._internal.needsConfirmation = true;
    const reasons = sensitiveFiles.map(f => `${f.path}: ${f.result.reason}`);
    execution._internal.confirmationReason = `Sensitive file access detected:\n${reasons.join('\n')}`;
  }

  /**
   * 
   */
  private getAffectedPaths(execution: ToolExecution): string[] {
    const params = execution.params;
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
