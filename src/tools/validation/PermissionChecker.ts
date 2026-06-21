/**
 * 
 * 
 */

import { minimatch } from 'minimatch';
import {
  PermissionResult,
  type PermissionCheckResult,
  type PermissionConfig,
  type ToolInvocationDescriptor,
} from '../execution/types.js';

/**
 * 
 */
export const DEFAULT_PERMISSION_CONFIG: PermissionConfig = {
  allow: [
    // 只读工具默认允
    'Read(**/*)',
    'Glob(**/*)',
    'Grep(**/*)',
  ],
  deny: [
    // 危险命令默认拒
    'Bash(rm -rf:*)',
    'Bash(sudo:*)',
    'Write(/etc/*)',
    'Write(/usr/*)',
    'Write(/System/*)',
  ],
  ask: [],
};

/**
 * 
 */
export class PermissionChecker {
  private config: PermissionConfig;

  constructor(config?: Partial<PermissionConfig>) {
    this.config = {
      allow: [...DEFAULT_PERMISSION_CONFIG.allow, ...(config?.allow || [])],
      deny: [...DEFAULT_PERMISSION_CONFIG.deny, ...(config?.deny || [])],
      ask: [...DEFAULT_PERMISSION_CONFIG.ask, ...(config?.ask || [])],
    };
  }

  /**
   * 
   */
  check(descriptor: ToolInvocationDescriptor): PermissionCheckResult {
    const signature = PermissionChecker.buildSignature(descriptor);

    // 1. 检查 deny 规则（优先级最
    for (const rule of this.config.deny) {
      if (this.matchesRule(signature, rule, descriptor)) {
        return {
          result: PermissionResult.DENY,
          matchedRule: rule,
          reason: `Not executed: rule "${rule}" excludes this action. Choose a different approach.`,
        };
      }
    }

    // 2. 检查 allow 规
    for (const rule of this.config.allow) {
      if (this.matchesRule(signature, rule, descriptor)) {
        return {
          result: PermissionResult.ALLOW,
          matchedRule: rule,
          reason: `Allowed by rule: ${rule}`,
        };
      }
    }

    // 3. 检查 ask 规
    for (const rule of this.config.ask) {
      if (this.matchesRule(signature, rule, descriptor)) {
        return {
          result: PermissionResult.ASK,
          matchedRule: rule,
          reason: `Requires confirmation by rule: ${rule}`,
        };
      }
    }

    // 4. 默
    return {
      result: PermissionResult.ASK,
      matchedRule: 'default',
      reason: 'No matching rule, requires confirmation',
    };
  }

  /**
   * 
   */
  static buildSignature(descriptor: ToolInvocationDescriptor): string {
    const { toolName, params, tool } = descriptor;

    // 使用工具的 extractSignatureContent 方法（如果存
    if (tool?.extractSignatureContent) {
      const content = tool.extractSignatureContent(params);
      return `${toolName}(${content})`;
    }

    // 如果没有工具对象，尝试从常见参数提取签名内
    const signatureContent = PermissionChecker.extractDefaultSignatureContent(toolName, params);
    if (signatureContent) {
      return `${toolName}(${signatureContent})`;
    }

    // 默认：只返回工具
    return toolName;
  }

  /**
   * 
   */
  private static extractDefaultSignatureContent(
    toolName: string,
    params: Record<string, unknown>
  ): string | null {
    switch (toolName) {
      case 'Bash':
        if (typeof params.command === 'string') {
          return params.command;
        }
        break;
      case 'Read':
      case 'Write':
      case 'Edit':
        if (typeof params.file_path === 'string') {
          return params.file_path;
        }
        break;
      case 'Glob':
        if (typeof params.pattern === 'string') {
          return params.pattern;
        }
        break;
      case 'Grep':
        if (typeof params.pattern === 'string') {
          return params.pattern;
        }
        break;
    }
    return null;
  }

  /**
   * 
   */
  private matchesRule(
    signature: string,
    rule: string,
    descriptor: ToolInvocationDescriptor
  ): boolean {
    // 1. 精确匹配工具
    if (rule === descriptor.toolName) {
      return true;
    }

    // 2. 解析规
    const match = rule.match(/^(\w+)(?:\((.+)\))?$/);
    if (!match) {
      return false;
    }

    const [, ruleTool, rulePattern] = match;

    // 工具名不匹
    if (ruleTool !== descriptor.toolName) {
      return false;
    }

    // 没有参数模式，匹配所有该工具的调
    if (!rulePattern) {
      return true;
    }

    // 3. 提取签名内
    const signatureContent = this.extractSignatureContent(signature);

    // 4. 匹配模
    return this.matchPattern(signatureContent, rulePattern);
  }

  /**
   * 
   */
  private extractSignatureContent(signature: string): string {
    const match = signature.match(/^\w+\((.+)\)$/);
    return match ? match[1] : '';
  }

  /**
   * 
   */
  private matchPattern(content: string, pattern: string): boolean {
    // 1. 前缀通配符 (npm:* 
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -2);
      return content.startsWith(prefix);
    }

    // 2. Glob 模
    if (pattern.includes('*') || pattern.includes('?')) {
      return minimatch(content, pattern, { dot: true });
    }

    // 3. 精确匹
    return content === pattern;
  }

  /**
   * 
   */
  addRule(type: 'allow' | 'deny' | 'ask', rule: string): void {
    this.config[type].push(rule);
  }

  /**
   * 
   */
  removeRule(type: 'allow' | 'deny' | 'ask', rule: string): boolean {
    const index = this.config[type].indexOf(rule);
    if (index !== -1) {
      this.config[type].splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 
   */
  getConfig(): PermissionConfig {
    return { ...this.config };
  }
}
