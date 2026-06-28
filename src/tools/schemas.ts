/**
 * 
 * 
 * 
 */

import { z } from 'zod';

/**
 * 
 */
export const ToolSchemas = {
  /**
   * 
   */
  filePath: (options?: { description?: string }) =>
    z.string()
      .min(1, '文件路径不能为空')
      .describe(options?.description || '文件路径'),

  /**
   * 
   */
  absolutePath: (options?: { description?: string }) =>
    z.string()
      .min(1, '路径不能为空')
      .refine(
        (path) => path.startsWith('/') || path.startsWith('~'),
        '必须是绝对路径（以 / 或 ~ 开头）'
      )
      .describe(options?.description || '绝对路径'),

  /**
   * 
   */
  lineNumber: (options?: { description?: string }) =>
    z.number()
      .int('必须是整数')
      .min(0, '行号不能为负')
      .describe(options?.description || '行号（从 0 开始）'),

  /**
   * 
   */
  lineLimit: (options?: { description?: string; max?: number }) =>
    z.number()
      .int('必须是整数')
      .min(1, '至少读取 1 行')
      .max(options?.max || 10000, `最多读取 ${options?.max || 10000} 行`)
      .describe(options?.description || '读取行数'),

  /**
   * 
   */
  encoding: () =>
    z.enum(['utf8', 'utf-8', 'ascii', 'base64', 'binary', 'hex'])
      .default('utf8')
      .describe('文件编码格式'),

  /**
   * Glob 模式
   */
  globPattern: (options?: { description?: string }) =>
    z.string()
      .min(1, '模式不能为空')
      .describe(options?.description || 'Glob 匹配模式'),

  /**
   * 
   */
  regexPattern: (options?: { description?: string }) =>
    z.string()
      .min(1, '模式不能为空')
      .describe(options?.description || '正则表达式模式'),

  /**
   * 
   */
  command: (options?: { description?: string }) =>
    z.string()
      .min(1, '命令不能为空')
      .describe(options?.description || 'Shell 命令'),

  /**
   * 
   */
  timeout: (options?: { max?: number; default?: number }) =>
    z.number()
      .int()
      .min(0)
      .max(options?.max || 600000)
      .default(options?.default || 30000)
      .describe('超时时间（毫秒）'),

  /**
   * 
   */
  booleanWithDefault: (defaultValue: boolean, description?: string) =>
    z.boolean()
      .default(defaultValue)
      .describe(description || '布尔选项'),
};

/**
 * 
 */
export function optional<T extends z.ZodType>(schema: T): z.ZodOptional<T> {
  return schema.optional();
}
