/**
 * 
 * 
 * 
 */

import { minimatch } from 'minimatch';
import type { MatcherConfig, MatchContext, HookMatcher, Hook } from './types.js';

/**
 */
export class Matcher {
  /**
   * 
   */
  matches(config: MatcherConfig | undefined, context: MatchContext): boolean {
    if (!config) {
      return true;
    }
    if (config.tools && context.toolName) {
      if (!this.matchesPattern(context.toolName, config.tools)) {
        return false;
      }
    }
    if (config.paths && context.filePath) {
      if (!this.matchesGlob(context.filePath, config.paths)) {
        return false;
      }
    }
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
   */
  private matchesPattern(value: string, pattern: string): boolean {
    if (!pattern.includes('\\') && !pattern.includes('^') && !pattern.includes('$')) {
      const parts = pattern.split('|');
      for (const part of parts) {
        if (value === part.trim()) {
          return true;
        }
      }
    }
    try {
      const regex = new RegExp(`^(${pattern})$`);
      return regex.test(value);
    } catch {
      return value === pattern;
    }
  }

  /**
   * 
   * 
   */
  private matchesGlob(filePath: string, pattern: string): boolean {
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
