/**
 * Write 工具
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
const WriteSchema = z.object({
    file_path: z.string()
        .min(1, '文件路径不能为空')
        .describe('The absolute path to the file to write'),
    contents: z.string()
        .describe('The contents to write to the file'),
});
// ========== Write 工
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
    category: '文件操作',
    tags: ['file', 'io', 'write', 'create'],
    // 提取签名内容（用于权限规
    extractSignatureContent: (params) => {
        const p = params;
        return p.file_path;
    },
    // 抽象权限规
    abstractPermissionRule: (params) => {
        const p = params;
        const dir = path.dirname(p.file_path);
        return `Write:${dir}/*`;
    },
    async execute(params, context) {
        const { file_path, contents } = params;
        try {
            // 1. 检查目标是否是目
            try {
                const stat = await fs.stat(file_path);
                if (stat.isDirectory()) {
                    return {
                        success: false,
                        llmContent: `Error: ${file_path} is a directory, cannot write to it`,
                        displayContent: `error: ${file_path} is a directory`,
                        error: {
                            type: ToolErrorType.VALIDATION_ERROR,
                            message: 'Path is a directory',
                        },
                    };
                }
            }
            catch {
                // 文件不存在，这是允许
            }
            // 2. 确保父目录存
            const dir = path.dirname(file_path);
            await fs.mkdir(dir, { recursive: true });
            // 3. 快照原始文件（如果已存在）
            let snapshotPath = null;
            try {
                await fs.access(file_path);
                snapshotPath = await createSnapshot(file_path);
            }
            catch { /* new file */ }
            // 4. 写入文
            await fs.writeFile(file_path, contents, 'utf8');
            // 5. 计算写入信
            const lines = contents.split('\n').length;
            const bytes = Buffer.byteLength(contents, 'utf8');
            return {
                success: true,
                llmContent: `Successfully wrote to ${file_path} (${lines} lines, ${bytes} bytes)`,
                displayContent: `${path.basename(file_path)}  ${lines} lines`,
                metadata: {
                    file_path,
                    lines,
                    bytes,
                    snapshot: snapshotPath,
                },
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'unknown error';
            return {
                success: false,
                llmContent: `Error writing file: ${errorMessage}`,
                displayContent: `error: ${errorMessage}`,
                error: {
                    type: ToolErrorType.EXECUTION_ERROR,
                    message: errorMessage,
                },
            };
        }
    },
});
//# sourceMappingURL=write.js.map