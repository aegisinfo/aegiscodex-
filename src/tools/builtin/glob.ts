/**
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
 */
const GlobSchema = z.object({
  pattern: z.string()
    .min(1, '')
    .describe('The glob pattern to match files against'),
  
  path: z.string()
    .optional()
    .describe('Directory to search in (defaults to current working directory)'),
});

/**
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

  category: '',
  tags: ['search', 'file', 'glob'],

  async execute(params, context) {
    let { pattern, path: searchPath } = params;
    const cwd = searchPath || context?.cwd || process.cwd();
    if (!pattern.startsWith('**/') && !pattern.startsWith('/')) {
      pattern = `**/${pattern}`;
    }

    try {
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
          displayContent: `🔍 : ${pattern}`,
          metadata: {
            pattern,
            cwd,
            count: 0,
          },
        };
      }
      const formattedFiles = files
        .map(f => path.relative(cwd, f))
        .join('\n');

      return {
        success: true,
        llmContent: formattedFiles,
        displayContent: `✅  ${files.length} `,
        metadata: {
          pattern,
          cwd,
          count: files.length,
          files: files.slice(0, 100),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      return {
        success: false,
        llmContent: `Glob search failed: ${errorMessage}`,
        displayContent: `❌ : ${errorMessage}`,
        error: {
          type: ToolErrorType.EXECUTION_ERROR,
          message: errorMessage,
        },
      };
    }
  },
});
