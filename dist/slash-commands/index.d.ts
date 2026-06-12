/**
 * Slash 命令模块
 *
 *
 */
import type { SlashCommand, SlashCommandContext, SlashCommandResult, CommandSuggestion } from './types.js';
export * from './types.js';
export { mcpCommand } from './mcpCommand.js';
export { builtinCommands } from './builtinCommands.js';
export { CustomCommandRegistry } from './custom/CustomCommandRegistry.js';
/**
 *
 *
 *
 * - ~/.aegis/commands/
 * - ~/.claude/commands/
 * - .aegis/commands/
 * - .claude/commands/
 */
export declare function initializeCustomCommands(workspaceRoot?: string): Promise<{
    count: number;
    warnings: string[];
}>;
/**
 *
 */
export declare function reloadCustomCommands(workspaceRoot?: string): Promise<{
    count: number;
    warnings: string[];
}>;
/**
 *
 */
export declare function getCommand(name: string): SlashCommand | undefined;
/**
 *
 */
export declare function getRegisteredCommands(): SlashCommand[];
/**
 *
 */
export declare function registerSlashCommand(command: SlashCommand): void;
/**
 *
 */
export declare function unregisterSlashCommand(name: string): boolean;
/**
 *
 */
export declare function isSlashCommand(input: string): boolean;
/**
 *
 */
export declare function parseSlashCommand(input: string): {
    name: string;
    args: string;
} | null;
/**
 *
 */
export declare function executeSlashCommand(input: string, context: SlashCommandContext): Promise<SlashCommandResult>;
/**
 *
 */
export declare function getFuzzyCommandSuggestions(input: string): CommandSuggestion[];
/**
 *
 */
export declare function getCommandCompletions(partialInput: string): CommandSuggestion[];
//# sourceMappingURL=index.d.ts.map