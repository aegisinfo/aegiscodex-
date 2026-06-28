/**
 * Hook 匹配器
 * 
 * 
 * 
 */

import { minimatch } from 'minimatch';
import type { MatcherConfig, MatchContext, HookMatcher, Hook } from './types.js';

/**
 * Hook 匹配器
 */
export class Matcher {
  /**
   * 
   */
  matches(config: MatcherConfig | undefined, context: MatchContext): boolean {
    // 无匹配器配置 = 匹配所
    if (!config) {
      return true;
    }

    // 检查工具名匹
    if (config.tools && context.toolName) {
      if (!this.matchesPattern(context.toolName, config.tools)) {
        return false;
      }
    }

    // 检查文件路径匹
    if (config.paths && context.filePath) {
      if (!this.matchesGlob(context.filePath, config.paths)) {
        return false;
      }
    }

    // 检查命令匹
    if (config.commands && context.command) {
      if (!this.matchesPattern(context.command, config.commands)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 
   */
  getMatchingHooks(matchers: HookMatcher[] | undefined, context: MatchContext): Hook[] {
    if (!matchers || matchers.length === 0) {
      return [];
    }

    const result: Hook[] = [];

    for (const matcher of matchers) {
      if (this.matches(matcher.matcher, context)) {
        result.push(...matcher.hooks);
      }
    }

    return result;
  }

  /**
   * 
   * 
   * 
   * - 简单字符串: "Read"
   * - 管道分隔: "Read|Write|Edit"
   * - 正则表达式: "Bash\\(.*\\)"
   */
  private matchesPattern(value: string, pattern: string): boolean {
    // 尝试作为管道分隔的简单模
    if (!pattern.includes('\\') && !pattern.includes('^') && !pattern.includes('$')) {
      const parts = pattern.split('|');
      for (const part of parts) {
        if (value === part.trim()) {
          return true;
        }
      }
    }

    // 尝试作为正则表达
    try {
      const regex = new RegExp(`^(${pattern})$`);
      return regex.test(value);
    } catch {
      // 正则无效，使用简单字符串比
      return value === pattern;
    }
  }

  /**
   * Glob 模式匹配
   * 
   * 
   * - 通配符: "*.ts"
   * - 双星: "**\/*.tsx"
   * - 多模式: "**\/*.{ts,tsx,js,jsx}"
   */
  private matchesGlob(filePath: string, pattern: string): boolean {
    // 处理管道分隔的多
    const patterns = pattern.split('|').map(p => p.trim());
    
    for (const p of patterns) {
      if (minimatch(filePath, p, { matchBase: true })) {
        return true;
      }
    }

    return false;
  }
}

/**
 * 
 */
export function extractFilePath(toolInput: Record<string, unknown>): string | undefined {
  // 常见的文件路径字段
  const pathFields = ['file_path', 'path', 'filePath', 'file', 'target'];
  
  for (const field of pathFields) {
    const value = toolInput[field];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

/**
 * 
 */
export function extractCommand(
  toolName: string,
  toolInput: Record<string, unknown>
): string | undefined {
  // 只有 Bash 工具有命
  if (toolName !== 'Bash' && toolName !== 'Shell') {
    return undefined;
  }

  const commandFields = ['command', 'cmd', 'script'];
  
  for (const field of commandFields) {
    const value = toolInput[field];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
}
