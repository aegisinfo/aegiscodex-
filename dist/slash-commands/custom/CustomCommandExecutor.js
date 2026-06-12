/**
 * CustomCommandExecutor - 自定义命令执行器
 *
 *
 * - 参数插值 ($ARGUMENTS, $1, $2, ...)
 * - Bash 命令嵌入 (!`command`)
 * - 文件引用 (@path/to/file)
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
/**
 *
 */
export class CustomCommandExecutor {
    /**
     *
     *
     *
     * 1. 参数插值
     * 2. Bash 命令嵌入执行
     * 3. 文件引用替换
     */
    async execute(command, context) {
        let content = command.content;
        // 1. 参数插
        content = this.interpolateArgs(content, context.args);
        // 2. Bash 嵌入执
        content = await this.executeBashEmbeds(content, context);
        // 3. 文件引用替
        content = await this.resolveFileReferences(content, context.workspaceRoot);
        return content;
    }
    /**
     *
     *
     *
     * - $ARGUMENTS - 全部参数（空格连接）
     * - $1, $2, ..., $9 - 位置参数
     */
    interpolateArgs(content, args) {
        // 替
        content = content.replace(/\$ARGUMENTS/g, args.join(' '));
        // 替换 $1, $2, ... $9（从大到小避免 $1 匹配 $10 的问
        for (let i = 9; i >= 1; i--) {
            content = content.split(`$${i}`).join(args[i - 1] ?? '');
        }
        return content;
    }
    /**
     *
     *
     *
     * - 命令在工作目录执行
     * - 30 秒超时
     * - 失败时显示错误信息
     */
    async executeBashEmbeds(content, context) {
        const regex = /!`([^`]+)`/g;
        let result = content;
        for (const match of content.matchAll(regex)) {
            const command = match[1];
            try {
                // 检查中断信
                if (context.signal?.aborted) {
                    result = result.replace(match[0], '[Aborted]');
                    continue;
                }
                const output = execSync(command, {
                    cwd: context.workspaceRoot,
                    encoding: 'utf-8',
                    timeout: 30000, // 30 秒超
                    maxBuffer: 1024 * 1024, // 1MB 输出限
                }).trim();
                result = result.replace(match[0], output);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                result = result.replace(match[0], `[Error: ${errorMessage}]`);
            }
        }
        return result;
    }
    /**
     *
     *
     *
     * - 路径相对于工作目录
     * - 自动用代码块包裹文件内容
     * - 文件不存在时保留原文
     */
    async resolveFileReferences(content, workspaceRoot) {
        // 匹
        const regex = /@([\w./-]+(?:\/[\w./-]+|\.[\w]+))/g;
        let result = content;
        for (const match of content.matchAll(regex)) {
            const relativePath = match[1];
            const filePath = path.resolve(workspaceRoot, relativePath);
            try {
                const stat = fs.statSync(filePath);
                if (stat.isFile()) {
                    const fileContent = fs.readFileSync(filePath, 'utf-8');
                    const ext = path.extname(relativePath).slice(1) || 'text';
                    // 用代码块包
                    const codeBlock = `\`\`\`${ext}\n${fileContent}\n\`\`\``;
                    result = result.replace(match[0], codeBlock);
                }
            }
            catch {
                // 文件不存在，保留原
            }
        }
        return result;
    }
}
//# sourceMappingURL=CustomCommandExecutor.js.map