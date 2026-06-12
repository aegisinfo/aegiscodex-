/**
 * CLI 中间件
 *
 *
 * - 验证参数
 * - 加载配置
 * - 设置全局状态
 */
import type { CliArguments } from './types.js';
/**
 *
 *
 *
 * 1. 处理 --yolo 快捷方式
 * 2. 检测工具列表冲突
 */
export declare const validatePermissions: (argv: CliArguments) => void;
/**
 *
 *
 *
 * 1. 初始化 ConfigManager
 * 2. 应用 CLI 参数
 * 3. 验证会话选项
 */
export declare const loadConfiguration: (argv: CliArguments) => Promise<void>;
/**
 *
 *
 *
 * 1. 验证输出格式组合
 */
export declare const validateOutput: (argv: CliArguments) => void;
/**
 *
 *
 */
export declare const middlewareChain: any[];
//# sourceMappingURL=middleware.d.ts.map