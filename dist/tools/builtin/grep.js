/**
 * Grep 工具 - 内容搜索
 */
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
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
    '**/*.min.js',
    '**/*.bundle.js',
];
/**
 *
 */
const MAX_RESULTS = 100;
/**
 * Grep 工具 Schema
 */
const GrepSchema = z.object({
    pattern: z.string()
        .min(1, '搜索模式不能为空')
        .describe('The regular expression pattern to search for'),
    path: z.string()
        .optional()
        .describe('Directory to search in (defaults to current working directory)'),
    include: z.string()
        .optional()
        .describe('Glob pattern to filter files (e.g., "*.ts" for TypeScript files)'),
    case_sensitive: z.boolean()
        .default(true)
        .describe('Whether the search is case sensitive'),
});
/**
 *
 */
async function searchInFile(filePath, regex) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const matches = [];
        for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
                matches.push({
                    file: filePath,
                    line: i + 1,
                    content: lines[i].trim(),
                });
            }
        }
        return matches;
    }
    catch {
        // 忽略无法读取的文
        return [];
    }
}
/**
 * Grep 工具
 */
export const grepTool = createTool({
    name: 'Grep',
    displayName: 'Content Search',
    kind: ToolKind.ReadOnly,
    schema: GrepSchema,
    description: {
        short: 'Search file contents using regular expressions',
        long: `A powerful search tool for finding patterns in file contents.
Supports full regex syntax and can filter files by glob pattern.`,
        usageNotes: [
            'Uses JavaScript regex syntax',
            'Common patterns: "function\\s+\\w+" for function definitions',
            'Use include parameter to filter files: "*.ts" for TypeScript only',
            'Results are limited to 100 matches for performance',
            'Automatically ignores node_modules, .git, dist directories',
        ],
        examples: [
            {
                description: 'Search for function definitions',
                params: { pattern: 'function\\s+\\w+' },
            },
            {
                description: 'Search in TypeScript files only',
                params: { pattern: 'export', include: '*.ts' },
            },
            {
                description: 'Case-insensitive search',
                params: { pattern: 'todo', case_sensitive: false },
            },
        ],
    },
    category: '搜索',
    tags: ['search', 'grep', 'regex'],
    async execute(params, context) {
        const { pattern, path: searchPath, include, case_sensitive } = params;
        // 默认搜索目
        const cwd = searchPath || context?.cwd || process.cwd();
        try {
            // 创建正则表达
            // 验证正则表达式是否包含未闭合的字符类或分组
            const unclosedBracket = (pattern.match(/\[/g) || []).length !== (pattern.match(/\]/g) || []).length;
            const unclosedParen = (pattern.match(/\(/g) || []).length !== (pattern.match(/\)/g) || []).length;
            if (unclosedBracket || unclosedParen) {
                return {
                    success: false,
                    llmContent: `Invalid regex pattern: ${pattern} — unclosed bracket or parenthesis`,
                    displayContent: `error: invalid regex — unclosed bracket or parenthesis`,
                    error: {
                        type: ToolErrorType.VALIDATION_ERROR,
                        message: 'Invalid regex pattern — unclosed bracket or parenthesis',
                    },
                };
            }
            let regex;
            try {
                regex = new RegExp(pattern, case_sensitive ? 'g' : 'gi');
            }
            catch (e) {
                return {
                    success: false,
                    llmContent: `Invalid regex pattern: ${pattern}`,
                    displayContent: `error: invalid regex: ${pattern}`,
                    error: {
                        type: ToolErrorType.VALIDATION_ERROR,
                        message: 'Invalid regex pattern',
                    },
                };
            }
            // 获取要搜索的文件列
            const filePattern = include
                ? (include.startsWith('**/') ? include : `**/${include}`)
                : '**/*';
            const files = await glob(filePattern, {
                cwd,
                ignore: DEFAULT_IGNORE,
                nodir: true,
                absolute: true,
            });
            // 过滤二进制文件（简单判
            const textExtensions = [
                '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
                '.json', '.md', '.txt', '.yaml', '.yml',
                '.html', '.css', '.scss', '.less',
                '.py', '.rb', '.go', '.rs', '.java',
                '.c', '.cpp', '.h', '.hpp',
                '.sh', '.bash', '.zsh',
                '.xml', '.svg',
            ];
            const textFiles = files.filter(f => textExtensions.some(ext => f.endsWith(ext)));
            // 搜索所有文
            const allMatches = [];
            for (const file of textFiles) {
                if (allMatches.length >= MAX_RESULTS)
                    break;
                const matches = await searchInFile(file, regex);
                allMatches.push(...matches);
                if (allMatches.length >= MAX_RESULTS) {
                    allMatches.length = MAX_RESULTS;
                    break;
                }
            }
            if (allMatches.length === 0) {
                return {
                    success: true,
                    llmContent: 'No matches found.',
                    displayContent: `no matches: ${pattern}`,
                    metadata: {
                        pattern,
                        cwd,
                        files_searched: textFiles.length,
                        matches: 0,
                    },
                };
            }
            // 格式化输
            const formattedMatches = allMatches
                .map(m => {
                const relPath = path.relative(cwd, m.file);
                return `${relPath}:${m.line}: ${m.content}`;
            })
                .join('\n');
            const truncated = allMatches.length >= MAX_RESULTS;
            let summary = `${allMatches.length} match${allMatches.length === 1 ? '' : 'es'}`;
            if (truncated) {
                summary += ` (truncated)`;
            }
            return {
                success: true,
                llmContent: formattedMatches,
                displayContent: summary,
                metadata: {
                    pattern,
                    cwd,
                    files_searched: textFiles.length,
                    matches: allMatches.length,
                    truncated,
                },
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'unknown error';
            return {
                success: false,
                llmContent: `Grep search failed: ${errorMessage}`,
                displayContent: `error: ${errorMessage}`,
                error: {
                    type: ToolErrorType.EXECUTION_ERROR,
                    message: errorMessage,
                },
            };
        }
    },
});
//# sourceMappingURL=grep.js.map