/**
 * Built-in slash commands
 */
import type { SlashCommand } from './types.js';
/**
 * /help - 显示所有可用命令
 */
export declare const helpCommand: SlashCommand;
/**
 * /clear - 清除对话历史
 */
export declare const clearCommand: SlashCommand;
/**
 * /compact - 手动压缩上下文
 */
export declare const compactCommand: SlashCommand;
/**
 * /version - 显示版本信息
 */
export declare const versionCommand: SlashCommand;
/**
 * /model - 显示或切换模型
 */
export declare const modelCommand: SlashCommand;
/**
 * /theme - 切换主题
 */
export declare const themeCommand: SlashCommand;
/**
 * /status - 显示会话状态
 */
export declare const statusCommand: SlashCommand;
/**
 * /skills - Skills 管理
 */
export declare const skillsCommand: SlashCommand;
/**
 * /hooks - Hooks 管理
 */
export declare const hooksCommand: SlashCommand;
/**
 * /copy - 复制代码块或文本到剪贴板
 *
 * /copy                    — kopiera senaste kodblocket
 * /copy N                  — kopiera kodblock N från slutet
 * /copy list               — lista alla kodblock
 * /copy last               — kopiera senaste assistent-svaret (plain text)
 * /copy raw <N|last>       — som ovan, men skriv ut i terminalen för manuell kopiering
 */
export declare const copyCommand: SlashCommand;
/**
 * /thinking - 切换思考块展开/折叠
 */
export declare const thinkingCommand: SlashCommand;
export declare const builtinCommands: SlashCommand[];
//# sourceMappingURL=builtinCommands.d.ts.map