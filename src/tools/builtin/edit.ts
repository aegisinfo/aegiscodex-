/**
 * 
 * 
 */

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { createTool } from '../createTool.js';
import { ToolKind, ToolErrorType } from '../types.js';

const EditSchema = z.object({
  file_path: z.string()
    .min(1, '')
    .describe('The absolute path to the file to modify'),
  old_string: z.string()
    .describe('The text to replace (must be unique in the file unless replace_all is true)'),
  new_string: z.string()
    .describe('The text to replace it with'),
  replace_all: z.boolean()
    .default(false)
    .describe('If true, replace all occurrences of old_string'),
});

export const editTool = createTool({
  name: 'Edit',
  displayName: 'File Edit',
  kind: ToolKind.Write,
  schema: EditSchema,
  
  description: {
    short: 'Performs exact string replacements in files',
    long: 'Edits files by replacing specified text with new text. Requires the old_string to be unique unless replace_all is true.',
    usageNotes: [
      'You MUST use the Read tool first before editing a file',
      'The edit will FAIL if old_string is not unique in the file',
      'Use replace_all=true for renaming variables across the file',
      'Preserve exact indentation (tabs/spaces) as it appears',
      'If you want to create a new file, use the Write tool instead',
    ],
    examples: [
      {
        description: 'Replace a function name',
        params: {
          file_path: '/path/to/file.ts',
          old_string: 'function oldName(',
          new_string: 'function newName(',
        },
      },
      {
        description: 'Replace all occurrences of a variable',
        params: {
          file_path: '/path/to/file.ts',
          old_string: 'oldVar',
          new_string: 'newVar',
          replace_all: true,
        },
      },
    ],
    important: [
      'NEVER guess file contents - always Read first',
      'If old_string is not found, the edit will fail',
      'If multiple matches found without replace_all, provide more context',
    ],
  },

  category: '',
  tags: ['file', 'io', 'write', 'edit'],
  extractSignatureContent: (params: unknown) => {
    const p = params as { file_path: string };
    return p.file_path;
  },
  abstractPermissionRule: (params: unknown) => {
    const p = params as { file_path: string };
    const dir = path.dirname(p.file_path);
    return `Edit:${dir}/*`;
  },

  async execute(params, context) {
    const { file_path, old_string, new_string, replace_all } = params;

    try {
      try {
        const stat = await fs.stat(file_path);
        if (stat.isDirectory()) {
          return {
            success: false,
            llmContent: `Error: ${file_path} is a directory, not a file`,
            displayContent: `❌ : ${file_path} `,
            error: {
              type: ToolErrorType.VALIDATION_ERROR,
              message: 'Path is a directory',
            },
          };
        }
      } catch (error) {
        return {
          success: false,
          llmContent: `Error: File not found: ${file_path}`,
          displayContent: `❌ : ${file_path}`,
          error: {
            type: ToolErrorType.VALIDATION_ERROR,
            message: 'File not found',
          },
        };
      }
      const content = await fs.readFile(file_path, 'utf8');
      if (old_string === new_string) {
        return {
          success: false,
          llmContent: 'Error: old_string and new_string are identical',
          displayContent: '❌ old_string  new_string ',
          error: {
            type: ToolErrorType.VALIDATION_ERROR,
            message: 'old_string and new_string are identical',
          },
        };
      }
      const matchCount = content.split(old_string).length - 1;
      
      if (matchCount === 0) {
        return {
          success: false,
          llmContent: `Error: old_string not found in file. Make sure you have read the file first and the content is up to date.`,
          displayContent: `❌ `,
          error: {
            type: ToolErrorType.VALIDATION_ERROR,
            message: 'old_string not found in file',
          },
        };
      }
      if (matchCount > 1 && !replace_all) {
        return {
          success: false,
          llmContent: `Error: Multiple matches (${matchCount}) found for old_string. Either:
1. Provide more context in old_string to make it unique
2. Set replace_all=true to replace all occurrences`,
          displayContent: `❌  ${matchCount} ， replace_all`,
          error: {
            type: ToolErrorType.VALIDATION_ERROR,
            message: `Multiple matches (${matchCount}) found`,
          },
        };
      }
      const newContent = replace_all
        ? content.replaceAll(old_string, new_string)
        : content.replace(old_string, new_string);
      await fs.writeFile(file_path, newContent, 'utf8');
      const replacements = replace_all ? matchCount : 1;

      return {
        success: true,
        llmContent: `Successfully edited ${file_path} (${replacements} replacement${replacements > 1 ? 's' : ''})`,
        displayContent: `✅ : ${file_path} (${replacements} )`,
        metadata: {
          file_path,
          replacements,
          old_string_preview: old_string.length > 50 
            ? old_string.substring(0, 50) + '...' 
            : old_string,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      return {
        success: false,
        llmContent: `Error editing file: ${errorMessage}`,
        displayContent: `❌ : ${errorMessage}`,
        error: {
          type: ToolErrorType.EXECUTION_ERROR,
          message: errorMessage,
        },
      };
    }
  },
});
