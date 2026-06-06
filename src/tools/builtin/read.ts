/**
 */

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { createTool } from '../createTool.js';
import { ToolKind, ToolErrorType } from '../types.js';

/**
 * 
 */
const DEFAULT_LINE_LIMIT = 2000;

/**
 */
const ReadSchema = z.object({
  file_path: z.string()
    .min(1, '')
    .describe('The absolute path to the file to read'),
  
  offset: z.number()
    .int()
    .min(0)
    .optional()
    .describe('The line number to start reading from (0-based)'),
  
  limit: z.number()
    .int()
    .min(1)
    .max(10000)
    .optional()
    .describe('The number of lines to read'),
});

/**
 */
export const readTool = createTool({
  name: 'Read',
  displayName: 'File Read',
  kind: ToolKind.ReadOnly,
  schema: ReadSchema,

  description: {
    short: 'Reads a file from the local filesystem',
    long: `Reads a file from the local filesystem. You can access any file directly by using this tool.
If the User provides a path to a file assume that path is valid.`,
    usageNotes: [
      'The file_path parameter must be an absolute path, not a relative path',
      `By default, it reads up to ${DEFAULT_LINE_LIMIT} lines starting from the beginning`,
      'You can optionally specify a line offset and limit for long files',
      'Lines in the output are numbered starting at 1',
      'You can call multiple Read tools in parallel to read multiple files at once',
    ],
    examples: [
      {
        description: 'Read entire file',
        params: { file_path: '/path/to/file.ts' },
      },
      {
        description: 'Read with offset and limit',
        params: { file_path: '/path/to/file.ts', offset: 100, limit: 50 },
      },
    ],
    important: [
      'file_path must be an absolute path',
      'Prefer reading the whole file by not providing offset/limit',
    ],
  },

  category: '',
  tags: ['file', 'read', 'io'],

  async execute(params, context) {
    const { file_path, offset = 0, limit } = params;
    const effectiveLimit = limit ?? DEFAULT_LINE_LIMIT;

    try {
      try {
        await fs.access(file_path);
      } catch {
        return {
          success: false,
          llmContent: `File not found: ${file_path}`,
          displayContent: `❌ : ${file_path}`,
          error: {
            type: ToolErrorType.EXECUTION_ERROR,
            message: 'File not found',
          },
        };
      }
      const stat = await fs.stat(file_path);
      if (stat.isDirectory()) {
        return {
          success: false,
          llmContent: `Path is a directory, not a file: ${file_path}`,
          displayContent: `❌ : ${file_path}`,
          error: {
            type: ToolErrorType.VALIDATION_ERROR,
            message: 'Path is a directory',
          },
        };
      }
      const content = await fs.readFile(file_path, 'utf-8');
      const lines = content.split('\n');
      const totalLines = lines.length;
      const selectedLines = lines.slice(offset, offset + effectiveLimit);
      const formattedContent = selectedLines
        .map((line, i) => {
          const lineNum = (offset + i + 1).toString().padStart(6, ' ');
          return `${lineNum}|${line}`;
        })
        .join('\n');
      const hasMore = offset + effectiveLimit < totalLines;
      const fileName = path.basename(file_path);
      let summary = `✅ : ${fileName}`;
      if (offset > 0 || limit) {
        summary += ` ( ${offset + 1}-${Math.min(offset + effectiveLimit, totalLines)}/${totalLines})`;
      } else {
        summary += ` (${totalLines} )`;
      }
      if (hasMore) {
        summary += ` [...]`;
      }

      return {
        success: true,
        llmContent: formattedContent,
        displayContent: summary,
        metadata: {
          file_path,
          total_lines: totalLines,
          lines_read: selectedLines.length,
          offset,
          has_more: hasMore,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      return {
        success: false,
        llmContent: `Failed to read file: ${errorMessage}`,
        displayContent: `❌ : ${errorMessage}`,
        error: {
          type: ToolErrorType.EXECUTION_ERROR,
          message: errorMessage,
        },
      };
    }
  },
});
