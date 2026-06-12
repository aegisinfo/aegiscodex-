/**
 * CustomCommandExecutor - 自定义命令执行器
 *
 *
 * - 参数插值 ($ARGUMENTS, $1, $2, ...)
 * - Bash 命令嵌入 (!`command`)
 * - 文件引用 (@path/to/file)
 */
import type { CustomCommand, CustomCommandExecutionContext } from '../types.js';
/**
 *
 */
export declare class CustomCommandExecutor {
    /**
     *
     *
     *
     * 1. 参数插值
     * 2. Bash 命令嵌入执行
     * 3. 文件引用替换
     */
    execute(command: CustomCommand, context: CustomCommandExecutionContext): Promise<string>;
    /**
     *
     *
     *
     * - $ARGUMENTS - 全部参数（空格连接）
     * - $1, $2, ..., $9 - 位置参数
     */
    private interpolateArgs;
    /**
     *
     *
     *
     * - 命令在工作目录执行
     * - 30 秒超时
     * - 失败时显示错误信息
     */
    private executeBashEmbeds;
    /**
     *
     *
     *
     * - 路径相对于工作目录
     * - 自动用代码块包裹文件内容
     * - 文件不存在时保留原文
     */
    private resolveFileReferences;
}
//# sourceMappingURL=CustomCommandExecutor.d.ts.map