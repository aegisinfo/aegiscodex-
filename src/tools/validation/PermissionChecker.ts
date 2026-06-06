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
    'Read(**/*)',
    'Glob(**/*)',
    'Grep(**/*)',
  ],
  deny: [
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
    for (const rule of this.config.deny) {
      if (this.matchesRule(signature, rule, descriptor)) {
        return {
          result: PermissionResult.DENY,
          matchedRule: rule,
          reason: `Denied by rule: ${rule}`,
        };
      }
    }
    for (const rule of this.config.allow) {
      if (this.matchesRule(signature, rule, descriptor)) {
        return {
          result: PermissionResult.ALLOW,
          matchedRule: rule,
          reason: `Allowed by rule: ${rule}`,
        };
      }
    }
    for (const rule of this.config.ask) {
      if (this.matchesRule(signature, rule, descriptor)) {
        return {
          result: PermissionResult.ASK,
          matchedRule: rule,
          reason: `Requires confirmation by rule: ${rule}`,
        };
      }
    }
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
    if (tool?.extractSignatureContent) {
      const content = tool.extractSignatureContent(params);
      return `${toolName}(${content})`;
    }
    const signatureContent = PermissionChecker.extractDefaultSignatureContent(toolName, params);
    if (signatureContent) {
      return `${toolName}(${signatureContent})`;
    }
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
    if (rule === descriptor.toolName) {
      return true;
    }
    const match = rule.match(/^(\w+)(?:\((.+)\))?$/);
    if (!match) {
      return false;
    }

    const [, ruleTool, rulePattern] = match;
    if (ruleTool !== descriptor.toolName) {
      return false;
    }
    if (!rulePattern) {
      return true;
    }
    const signatureContent = this.extractSignatureContent(signature);
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
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -2);
      return content.startsWith(prefix);
    }
    if (pattern.includes('*') || pattern.includes('?')) {
      return minimatch(content, pattern, { dot: true });
    }
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
