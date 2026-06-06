/**
 * 
 * 
 */

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { createTool } from '../createTool.js';
import { ToolKind, ToolErrorType } from '../types.js';

const WriteSchema = z.object({
  file_path: z.string()
    .min(1, '')
    .describe('The absolute path to the file to write'),
  contents: z.string()
    .describe('The contents to write to the file'),
});

export const writeTool = createTool({
  name: 'Write',
  displayName: 'File Write',
  kind: ToolKind.Write,
  schema: WriteSchema,
  
  description: {
    short: 'Writes a file to the local filesystem',
    long: 'Creates a new file or overwrites an existing file with the specified contents.',
    usageNotes: [
      'This tool will overwrite the existing file if there is one at the provided path',
      'ALWAYS prefer editing existing files in the codebase using Edit tool',
      'NEVER write new files unless explicitly required',
      'NEVER proactively create documentation files (*.md) or README files',
      'Parent directories will be created automatically if they do not exist',
    ],
    examples: [
      {
        description: 'Create a new TypeScript file',
        params: {
          file_path: '/path/to/new-file.ts',
          contents: 'export const hello = "world";',
        },
      },
    ],
    important: [
      'Only create files that are absolutely necessary',
      'Do not create README or documentation files unless explicitly requested',
    ],
  },

  category: '',
  tags: ['file', 'io', 'write', 'create'],
  extractSignatureContent: (params: unknown) => {
    const p = params as { file_path: string };
    return p.file_path;
  },
  abstractPermissionRule: (params: unknown) => {
    const p = params as { file_path: string };
    const dir = path.dirname(p.file_path);
    return `Write:${dir}/*`;
  },

  async execute(params, context) {
    const { file_path, contents } = params;

    try {
      try {
        const stat = await fs.stat(file_path);
        if (stat.isDirectory()) {
          return {
            success: false,
            llmContent: `Error: ${file_path} is a directory, cannot write to it`,
            displayContent: `❌ : ${file_path} `,
            error: {
              type: ToolErrorType.VALIDATION_ERROR,
              message: 'Path is a directory',
            },
          };
        }
      } catch {
      }
      const dir = path.dirname(file_path);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(file_path, contents, 'utf8');
      const lines = contents.split('\n').length;
      const bytes = Buffer.byteLength(contents, 'utf8');

      return {
        success: true,
        llmContent: `Successfully wrote to ${file_path} (${lines} lines, ${bytes} bytes)`,
        displayContent: `✅ : ${file_path} (${lines} )`,
        metadata: {
          file_path,
          lines,
          bytes,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      return {
        success: false,
        llmContent: `Error writing file: ${errorMessage}`,
        displayContent: `❌ : ${errorMessage}`,
        error: {
          type: ToolErrorType.EXECUTION_ERROR,
          message: errorMessage,
        },
      };
    }
  },
});
