/**
 * Glob 工具 - 文件搜索
 */

import { glob } from 'glob';
import path from 'path';
import { z } from 'zod';
import { createTool } from '../createTool.js';
import { ToolKind, ToolErrorType } from '../types.js';

/**
 * 
 */
const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
];

/**
 * Glob 工具 Schema
 */
const GlobSchema = z.object({
  pattern: z.string()
    .min(1, '模式不能为空')
    .describe('The glob pattern to match files against'),
  
  path: z.string()
    .optional()
    .describe('Directory to search in (defaults to current working directory)'),
});

/**
 * Glob 工具
 */
export const globTool = createTool({
  name: 'Glob',
  displayName: 'File Search',
  kind: ToolKind.ReadOnly,
  schema: GlobSchema,

  description: {
    short: 'Find files matching a glob pattern',
    long: `Search for files matching a glob pattern. Returns matching file paths sorted by modification time.
Use this tool when you need to find files by name patterns.`,
    usageNotes: [
      'Patterns not starting with "**/" are automatically prepended with "**/" to enable recursive searching',
      'Common patterns: "*.ts" for TypeScript files, "*.test.ts" for test files',
      'Results are sorted by modification time (newest first)',
      'Automatically ignores node_modules, .git, dist, build directories',
    ],
    examples: [
      {
        description: 'Find all TypeScript files',
        params: { pattern: '*.ts' },
      },
      {
        description: 'Find all test files',
        params: { pattern: '**/*.test.ts' },
      },
      {
        description: 'Find files in specific directory',
        params: { pattern: '*.json', path: '/project/config' },
      },
    ],
  },

  category: '搜索',
  tags: ['search', 'file', 'glob'],

  async execute(params, context) {
    let { pattern, path: searchPath } = params;
    
    // 默认搜索目
    const cwd = searchPath || context?.cwd || process.cwd();

    // 自动添
    if (!pattern.startsWith('**/') && !pattern.startsWith('/')) {
      pattern = `**/${pattern}`;
    }

    try {
      // 执行 glob 搜
      const files = await glob(pattern, {
        cwd,
        ignore: DEFAULT_IGNORE,
        nodir: true,
        absolute: true,
      });

      if (files.length === 0) {
        return {
          success: true,
          llmContent: 'No files found matching the pattern.',
          displayContent: `🔍 未找到匹配的文件: ${pattern}`,
          metadata: {
            pattern,
            cwd,
            count: 0,
          },
        };
      }

      // 格式化输
      const formattedFiles = files
        .map(f => path.relative(cwd, f))
        .join('\n');

      return {
        success: true,
        llmContent: formattedFiles,
        displayContent: `✅ 找到 ${files.length} 个文件`,
        metadata: {
          pattern,
          cwd,
          count: files.length,
          files: files.slice(0, 100), // 只存储前 100 
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      return {
        success: false,
        llmContent: `Glob search failed: ${errorMessage}`,
        displayContent: `❌ 搜索失败: ${errorMessage}`,
        error: {
          type: ToolErrorType.EXECUTION_ERROR,
          message: errorMessage,
        },
      };
    }
  },
});
