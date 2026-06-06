/**
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
export * from './types.js';
export { mcpCommand } from './mcpCommand.js';
export { builtinCommands } from './builtinCommands.js';
export { CustomCommandRegistry } from './custom/CustomCommandRegistry.js';

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
  for (const cmd of builtinCommands) {
    commandRegistry[cmd.name] = cmd;
  }
  commandRegistry[mcpCommand.name] = mcpCommand;
}
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
      warnings: [`Custom command initialization failed: ${error instanceof Error ? error.message : String(error)}`],
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
    description: customCmd.config.description || ` ${label}`,
    fullDescription: customCmd.config.description,
    usage: customCmd.config.argumentHint 
      ? `/${customCmd.name} ${customCmd.config.argumentHint}`
      : `/${customCmd.name}`,
    category: 'custom',
    
    async handler(args: string, context: SlashCommandContext): Promise<SlashCommandResult> {
      try {
        const argArray = args.trim() ? args.trim().split(/\s+/) : [];
        const content = await registry.executeCommand(customCmd.name, {
          args: argArray,
          workspaceRoot: context.cwd,
        });
        
        if (content === null) {
          return {
            success: false,
            type: 'error',
            error: ` /${customCmd.name} `,
          };
        }
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
          error: `: ${error instanceof Error ? error.message : String(error)}`,
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
  for (const [name, cmd] of Object.entries(commandRegistry)) {
    if (cmd.category === 'custom') {
      delete commandRegistry[name];
    }
  }
  
  customCommandsInitialized = false;
  return initializeCustomCommands(workspaceRoot);
}

/**
 * 
 */
export function getCommand(name: string): SlashCommand | undefined {
  const normalizedName = name.toLowerCase();
  if (commandRegistry[normalizedName]) {
    return commandRegistry[normalizedName];
  }
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

/**
 * 
 */
export function isSlashCommand(input: string): boolean {
  return input.trim().startsWith('/');
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
  const spaceIndex = withoutSlash.indexOf(' ');

  if (spaceIndex === -1) {
    return { name: withoutSlash, args: '' };
  }

  return {
    name: withoutSlash.slice(0, spaceIndex),
    args: withoutSlash.slice(spaceIndex + 1),
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
      error: '',
    };
  }
  
  const { name, args } = parsed;
  const command = getCommand(name);
  
  if (!command) {
    const suggestions = getFuzzyCommandSuggestions(name);
    let errorMsg = `: /${name}`;
    
    if (suggestions.length > 0) {
      errorMsg += `\n\n：\n`;
      for (const s of suggestions.slice(0, 3)) {
        errorMsg += `- \`${s.command}\` - ${s.description}\n`;
      }
    }
    
    errorMsg += `\n \`/help\` `;
    
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
      error: `: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

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
  if (!query) {
    return searchableCommands.map((item) => ({
      command: `/${item.name}`,
      description: item.description,
      matchScore: 50,
    }));
  }
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
    return Object.values(commandRegistry).map((cmd) => ({
      command: `/${cmd.name}`,
      description: cmd.description,
      matchScore: 50,
    }));
  }
  
  return getFuzzyCommandSuggestions(query);
}
