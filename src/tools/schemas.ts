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
      .min(1, '')
      .describe(options?.description || ''),

  /**
   * 
   */
  absolutePath: (options?: { description?: string }) =>
    z.string()
      .min(1, '')
      .refine(
        (path) => path.startsWith('/') || path.startsWith('~'),
        '（ /  ~ ）'
      )
      .describe(options?.description || ''),

  /**
   * 
   */
  lineNumber: (options?: { description?: string }) =>
    z.number()
      .int('')
      .min(0, '')
      .describe(options?.description || '（ 0 ）'),

  /**
   * 
   */
  lineLimit: (options?: { description?: string; max?: number }) =>
    z.number()
      .int('')
      .min(1, ' 1 ')
      .max(options?.max || 10000, ` ${options?.max || 10000} `)
      .describe(options?.description || ''),

  /**
   * 
   */
  encoding: () =>
    z.enum(['utf8', 'utf-8', 'ascii', 'base64', 'binary', 'hex'])
      .default('utf8')
      .describe(''),

  /**
   */
  globPattern: (options?: { description?: string }) =>
    z.string()
      .min(1, '')
      .describe(options?.description || 'Glob '),

  /**
   * 
   */
  regexPattern: (options?: { description?: string }) =>
    z.string()
      .min(1, '')
      .describe(options?.description || ''),

  /**
   * 
   */
  command: (options?: { description?: string }) =>
    z.string()
      .min(1, '')
      .describe(options?.description || 'Shell '),

  /**
   * 
   */
  timeout: (options?: { max?: number; default?: number }) =>
    z.number()
      .int()
      .min(0)
      .max(options?.max || 600000)
      .default(options?.default || 30000)
      .describe('（）'),

  /**
   * 
   */
  booleanWithDefault: (defaultValue: boolean, description?: string) =>
    z.boolean()
      .default(defaultValue)
      .describe(description || ''),
};

/**
 * 
 */
export function optional<T extends z.ZodType>(schema: T): z.ZodOptional<T> {
  return schema.optional();
}
