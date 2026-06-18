/**
 * Slash 命令模块
 * 
 * 
 */

import Fuse from 'fuse.js';
import type { 
  SlashCommand, 
  SlashCommandContext, 
  SlashCommandResult,
  CommandSuggestion,
  SlashCommandRegistry,
  CustomCommand,
} from './types.js';
import { builtinCommands } from './builtinCommands.js';
import { mcpCommand } from './mcpCommand.js';
import { CustomCommandRegistry } from './custom/CustomCommandRegistry.js';

// 导出类
export * from './types.js';
export { mcpCommand } from './mcpCommand.js';
export { builtinCommands } from './builtinCommands.js';
export { CustomCommandRegistry } from './custom/CustomCommandRegistry.js';

// ==================== 命令注册

/**
 * 
 */
const commandRegistry: SlashCommandRegistry = {};

/**
 * 
 */
let customCommandsInitialized = false;

/**
 * 
 */
function initializeRegistry(): void {
  // 注册内置命
  for (const cmd of builtinCommands) {
    commandRegistry[cmd.name] = cmd;
  }
  
  // 注册 MCP 命
  commandRegistry[mcpCommand.name] = mcpCommand;
}

// 初始化内置命
initializeRegistry();

/**
 * 
 * 
 * 
 * - ~/.aegis/commands/
 * - ~/.claude/commands/
 * - .aegis/commands/
 * - .claude/commands/
 */
export async function initializeCustomCommands(workspaceRoot?: string): Promise<{
  count: number;
  warnings: string[];
}> {
  if (customCommandsInitialized) {
    return { count: 0, warnings: [] };
  }

  const cwd = workspaceRoot || process.cwd();
  const registry = CustomCommandRegistry.getInstance();
  
  try {
    const result = await registry.initialize(cwd);
    
    // 将自定义命令转换为 SlashCommand 并注
    for (const customCmd of result.commands) {
      const slashCmd = convertCustomToSlashCommand(customCmd, registry);
      commandRegistry[customCmd.name] = slashCmd;
    }
    
    customCommandsInitialized = true;
    
    return {
      count: result.commands.length,
      warnings: result.warnings,
    };
  } catch (error) {
    return {
      count: 0,
      warnings: [`自定义命令初始化失败: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * 
 */
function convertCustomToSlashCommand(
  customCmd: CustomCommand,
  registry: CustomCommandRegistry
): SlashCommand {
  const label = registry.getCommandLabel(customCmd);
  
  return {
    name: customCmd.name,
    description: customCmd.config.description || `自定义命令 ${label}`,
    fullDescription: customCmd.config.description,
    usage: customCmd.config.argumentHint 
      ? `/${customCmd.name} ${customCmd.config.argumentHint}`
      : `/${customCmd.name}`,
    category: 'custom',
    
    async handler(args: string, context: SlashCommandContext): Promise<SlashCommandResult> {
      try {
        // 解析参
        const argArray = args.trim() ? args.trim().split(/\s+/) : [];
        
        // 执行自定义命
        const content = await registry.executeCommand(customCmd.name, {
          args: argArray,
          workspaceRoot: context.cwd,
        });
        
        if (content === null) {
          return {
            success: false,
            type: 'error',
            error: `命令 /${customCmd.name} 未找到`,
          };
        }
        
        // 自定义命令：内容发送给 Agent 执行（对齐 Claude Code 设
        return {
          success: true,
          type: 'success',
          content: content,
          sendToAgent: true,
        };
      } catch (error) {
        return {
          success: false,
          type: 'error',
          error: `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}

/**
 * 
 */
export async function reloadCustomCommands(workspaceRoot?: string): Promise<{
  count: number;
  warnings: string[];
}> {
  // 移除现有的自定义命
  for (const [name, cmd] of Object.entries(commandRegistry)) {
    if (cmd.category === 'custom') {
      delete commandRegistry[name];
    }
  }
  
  customCommandsInitialized = false;
  return initializeCustomCommands(workspaceRoot);
}

// ==================== 命令查

/**
 * 
 */
export function getCommand(name: string): SlashCommand | undefined {
  const normalizedName = name.toLowerCase();
  
  // 直接匹
  if (commandRegistry[normalizedName]) {
    return commandRegistry[normalizedName];
  }
  
  // 按别名查
  for (const cmd of Object.values(commandRegistry)) {
    if (cmd.aliases?.includes(normalizedName)) {
      return cmd;
    }
  }
  
  return undefined;
}

/**
 * 
 */
export function getRegisteredCommands(): SlashCommand[] {
  return Object.values(commandRegistry);
}

/**
 * 
 */
export function registerSlashCommand(command: SlashCommand): void {
  commandRegistry[command.name] = command;
}

/**
 * 
 */
export function unregisterSlashCommand(name: string): boolean {
  if (commandRegistry[name]) {
    delete commandRegistry[name];
    return true;
  }
  return false;
}

// ==================== 命令解析与执

/**
 * 
 */
export function isSlashCommand(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return false;

  // A real command name is a single word ("/help", "/model"); filesystem
  // paths ("/home/neo/foo") also start with '/' but contain further '/'
  // in that first token — treat those as plain chat text, not a command.
  const firstToken = trimmed.slice(1).split(/\s/)[0];
  return firstToken.length > 0 && !firstToken.includes('/');
}

/**
 * 
 */
export function parseSlashCommand(input: string): { name: string; args: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  const withoutSlash = trimmed.slice(1);
  const wsIndex = withoutSlash.search(/\s/);

  if (wsIndex === -1) {
    return { name: withoutSlash, args: '' };
  }

  return {
    name: withoutSlash.slice(0, wsIndex),
    args: withoutSlash.slice(wsIndex + 1),
  };
}

/**
 * 
 */
export async function executeSlashCommand(
  input: string,
  context: SlashCommandContext
): Promise<SlashCommandResult> {
  const parsed = parseSlashCommand(input);
  
  if (!parsed) {
    return {
      success: false,
      type: 'error',
      error: '无效的命令格式',
    };
  }
  
  const { name, args } = parsed;
  const command = getCommand(name);
  
  if (!command) {
    // 尝试模糊匹配建
    const suggestions = getFuzzyCommandSuggestions(name);
    let errorMsg = `Unknown command: /${name}`;

    if (suggestions.length > 0) {
      errorMsg += `\n\nDid you mean:\n`;
      for (const s of suggestions.slice(0, 3)) {
        errorMsg += `- \`${s.command}\` - ${s.description}\n`;
      }
    }

    errorMsg += `\nUse \`/help\` to see available commands`;
    
    return {
      success: false,
      type: 'error',
      error: errorMsg,
    };
  }
  
  try {
    return await command.handler(args, context);
  } catch (error) {
    return {
      success: false,
      type: 'error',
      error: `Command failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ==================== 模糊匹

/**
 * 
 */
export function getFuzzyCommandSuggestions(input: string): CommandSuggestion[] {
  const query = (input.startsWith('/') ? input.slice(1) : input).trim().toLowerCase();
  
  const searchableCommands = Object.values(commandRegistry).map((cmd) => ({
    name: cmd.name,
    description: cmd.description,
    aliases: cmd.aliases || [],
  }));
  
  // 没有输入，返回所有命
  if (!query) {
    return searchableCommands.map((item) => ({
      command: `/${item.name}`,
      description: item.description,
      matchScore: 50,
    }));
  }
  
  // 精确前缀匹配优
  const prefixMatches = searchableCommands.filter(
    (cmd) => cmd.name.startsWith(query) || cmd.aliases.some((a) => a.startsWith(query))
  );
  
  if (prefixMatches.length > 0) {
    return prefixMatches.map((item) => ({
      command: `/${item.name}`,
      description: item.description,
      matchScore: 90,
    }));
  }
  
  // 使用 Fuse.js 模糊匹
  const fuse = new Fuse(searchableCommands, {
    keys: [
      { name: 'name', weight: 3 },
      { name: 'aliases', weight: 2.5 },
      { name: 'description', weight: 0.5 },
    ],
    threshold: 0.4,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 1,
  });
  
  const results = fuse.search(query);
  
  return results
    .map((result) => ({
      command: `/${result.item.name}`,
      description: result.item.description,
      matchScore: Math.round((1 - (result.score ?? 1)) * 100),
    }))
    .filter((s) => (s.matchScore || 0) >= 40);
}

/**
 * 
 */
export function getCommandCompletions(partialInput: string): CommandSuggestion[] {
  if (!partialInput.startsWith('/')) {
    return [];
  }
  
  const query = partialInput.slice(1).toLowerCase();
  
  if (!query) {
    // 返回所有命
    return Object.values(commandRegistry).map((cmd) => ({
      command: `/${cmd.name}`,
      description: cmd.description,
      matchScore: 50,
    }));
  }
  
  return getFuzzyCommandSuggestions(query);
}
