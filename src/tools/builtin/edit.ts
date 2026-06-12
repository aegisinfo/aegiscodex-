/**
 * Edit 工具
 * 
 * 
 */

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { createTool } from '../createTool.js';
import { ToolKind, ToolErrorType } from '../types.js';
import { createSnapshot } from './snapshot.js';

// ========== Schema 定

const EditSchema = z.object({
  file_path: z.string()
    .min(1, '文件路径不能为空')
    .describe('The absolute path to the file to modify'),
  old_string: z.string()
    .describe('The text to replace (must be unique in the file unless replace_all is true)'),
  new_string: z.string()
    .describe('The text to replace it with'),
  replace_all: z.boolean()
    .default(false)
    .describe('If true, replace all occurrences of old_string'),
});

// ========== Edit 工

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

  category: '文件操作',
  tags: ['file', 'io', 'write', 'edit'],

  // 提取签名内容（用于权限规
  extractSignatureContent: (params: unknown) => {
    const p = params as { file_path: string };
    return p.file_path;
  },

  // 抽象权限规
  abstractPermissionRule: (params: unknown) => {
    const p = params as { file_path: string };
    const dir = path.dirname(p.file_path);
    return `Edit:${dir}/*`;
  },

  async execute(params, context) {
    const { file_path, old_string, new_string, replace_all } = params;

    try {
      // 1. 检查文件是否存
      try {
        const stat = await fs.stat(file_path);
        if (stat.isDirectory()) {
          return {
            success: false,
            llmContent: `Error: ${file_path} is a directory, not a file`,
            displayContent: `error: ${file_path} is a directory`,
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
          displayContent: `error: file not found: ${file_path}`,
          error: {
            type: ToolErrorType.VALIDATION_ERROR,
            message: 'File not found',
          },
        };
      }

      // 2. 读取文件内
      const content = await fs.readFile(file_path, 'utf8');

      // 3. old_string 和 new_string 相同检
      if (old_string === new_string) {
        return {
          success: false,
          llmContent: 'Error: old_string and new_string are identical',
          displayContent: 'error: old_string and new_string are identical',
          error: {
            type: ToolErrorType.VALIDATION_ERROR,
            message: 'old_string and new_string are identical',
          },
        };
      }

      // 4. 检查 old_string 是否存
      const matchCount = content.split(old_string).length - 1;
      
      if (matchCount === 0) {
        return {
          success: false,
          llmContent: `Error: old_string not found in file. Make sure you have read the file first and the content is up to date.`,
          displayContent: `error: old_string not found in file`,
          error: {
            type: ToolErrorType.VALIDATION_ERROR,
            message: 'old_string not found in file',
          },
        };
      }

      // 5. 多重匹配检查（非 replace_all 模
      if (matchCount > 1 && !replace_all) {
        return {
          success: false,
          llmContent: `Error: Multiple matches (${matchCount}) found for old_string. Either:
1. Provide more context in old_string to make it unique
2. Set replace_all=true to replace all occurrences`,
          displayContent: `error: ${matchCount} matches found — use replace_all or add more context`,
          error: {
            type: ToolErrorType.VALIDATION_ERROR,
            message: `Multiple matches (${matchCount}) found`,
          },
        };
      }

      // 6. 快照原始文件（支持 undo）
      const snapshotPath = await createSnapshot(file_path);

      // 7. 执行替
      const newContent = replace_all
        ? content.replaceAll(old_string, new_string)
        : content.replace(old_string, new_string);

      // 8. 写入文
      await fs.writeFile(file_path, newContent, 'utf8');

      // 9. 计算替换数
      const replacements = replace_all ? matchCount : 1;

      return {
        success: true,
        llmContent: `Successfully edited ${file_path} (${replacements} replacement${replacements > 1 ? 's' : ''})`,
        displayContent: `${path.basename(file_path)}  ${replacements} edit${replacements > 1 ? 's' : ''}`,
        metadata: {
          file_path,
          replacements,
          snapshot: snapshotPath,
          old_string_preview: old_string.length > 50
            ? old_string.substring(0, 50) + '...'
            : old_string,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown error';
      return {
        success: false,
        llmContent: `Error editing file: ${errorMessage}`,
        displayContent: `error: ${errorMessage}`,
        error: {
          type: ToolErrorType.EXECUTION_ERROR,
          message: errorMessage,
        },
      };
    }
  },
});
