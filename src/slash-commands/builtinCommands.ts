/**
 * 
 */

import type { SlashCommand, SlashCommandResult, SlashCommandContext } from './types.js';
import { sessionActions, getState, getConfig, getCurrentModel } from '../store/index.js';
import { createDefaultOrchestrator, CouncilAgent } from '../agent/orchestrator/index.js';

/**
 * /help - 显示所有可用命令
 */
export const helpCommand: SlashCommand = {
  name: 'help',
  aliases: ['?', 'h'],
  description: 'Show available commands',
  category: 'general',
  usage: '/help [command]',

  async handler(args: string, _context: SlashCommandContext): Promise<SlashCommandResult> {
    // 延迟导入避免循环依
    const { getRegisteredCommands, getCommand } = await import('./index.js');
    
    const trimmedArgs = args.trim();
    
    // 查看特定命令的帮
    if (trimmedArgs) {
      const cmd = getCommand(trimmedArgs);
      if (cmd) {
        let content = `## /${cmd.name}\n\n`;
        content += `${cmd.fullDescription || cmd.description}\n\n`;
        
        if (cmd.usage) {
          content += `**usage:** \`${cmd.usage}\`\n\n`;
        }
        
        if (cmd.aliases && cmd.aliases.length > 0) {
          content += `**aliases:** ${cmd.aliases.map(a => `/${a}`).join(', ')}\n\n`;
        }
        
        if (cmd.examples && cmd.examples.length > 0) {
          content += `**examples:**\n`;
          for (const example of cmd.examples) {
            content += `- \`${example}\`\n`;
          }
        }
        
        return { success: true, type: 'info', content };
      }
      
      return {
        success: false,
        type: 'error',
        error: `unknown command: /${trimmedArgs}`,
      };
    }
    
    // 显示所有命
    const commands = getRegisteredCommands();
    
    // 按分类分
    const grouped: Record<string, SlashCommand[]> = {};
    for (const cmd of commands) {
      const category = cmd.category || 'general';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(cmd);
    }
    
    // 分类名称映
    const categoryNames: Record<string, string> = {
      general: 'general',
      session: 'session',
      config: 'config',
      skills: 'skills',
      hooks: 'hooks',
      git: 'git',
      custom: 'custom',
    };
    
    let content = '## Commands\n\n';
    
    for (const [category, cmds] of Object.entries(grouped)) {
      const categoryName = categoryNames[category] || category;
      content += `### ${categoryName}\n\n`;
      
      for (const cmd of cmds) {
        const aliases = cmd.aliases?.length 
          ? ` (${cmd.aliases.map(a => `/${a}`).join(', ')})` 
          : '';
        content += `- \`/${cmd.name}\`${aliases} - ${cmd.description}\n`;
      }
      content += '\n';
    }
    
    content += `/help <cmd> for details\n`;
    
    return { success: true, type: 'info', content };
  },
};

/**
 * /clear - 清除对话历史
 */
export const clearCommand: SlashCommand = {
  name: 'clear',
  aliases: ['cls'],
  description: 'Clear chat history',
  category: 'session',
  usage: '/clear',

  async handler(): Promise<SlashCommandResult> {
    sessionActions().clearMessages();
    
    return {
      success: true,
      type: 'success',
      message: 'cleared',
    };
  },
};

/**
 * /compact - 手动压缩上下文
 */
export const compactCommand: SlashCommand = {
  name: 'compact',
  description: 'Compact context manually',
  category: 'session',
  usage: '/compact',
  fullDescription: 'Trigger manual context compaction, summarizing conversation history to save tokens.',

  async handler(_args: string, context: SlashCommandContext): Promise<SlashCommandResult> {
    const { contextManager, chatService, modelName } = context;
    
    if (!contextManager) {
      return {
        success: false,
        type: 'error',
        error: 'context manager unavailable',
      };
    }

    try {
      // 标记开始压
      sessionActions().setCompacting(true);
      
      const contextMessages = contextManager.getMessages();
      const currentTokens = contextManager.getTokenCount();
      
      if (contextMessages.length < 4) {
        sessionActions().setCompacting(false);
        return {
          success: true,
          type: 'info',
          message: 'history too short, skipping compaction',
        };
      }

      // 动态导入避免循环依
      const { CompactionService } = await import('../context/CompactionService.js');
      
      // 获取 maxContextTokens 配
      const state = getState();
      const runtimeConfig = state.config.config;
      const maxContextTokens = runtimeConfig?.maxContextTokens || 200000;
      
      // 转换消息格
      const messages = contextMessages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant' | 'system' | 'tool',
        content: m.content,
      }));
      
      const result = await CompactionService.compact(messages, {
        modelName: modelName || 'claude-sonnet-4-20250514',
        maxContextTokens,
        chatService,
        trigger: 'manual',
        actualPreTokens: currentTokens,
      });

      if (result.success) {
        // 将 Message[] 转换为 ContextMessage[] 格
        const { nanoid } = await import('nanoid');
        const compactedContextMessages = result.compactedMessages.map(m => ({
          id: nanoid(),
          role: m.role as 'user' | 'assistant' | 'system' | 'tool',
          content: m.content,
          timestamp: Date.now(),
        }));
        
        // 更新 ContextManager 中的消
        contextManager.replaceMessages(compactedContextMessages);
        
        // 更新 token 统
        contextManager.updateTokenCount(result.postTokens);
        
        const savedTokens = result.preTokens - result.postTokens;
        const savedPercent = Math.round((savedTokens / result.preTokens) * 100);

        return {
          success: true,
          type: 'success',
          content: `## Context compacted

| metric | value |
|--------|-------|
| before | ${result.preTokens.toLocaleString()} tokens |
| after | ${result.postTokens.toLocaleString()} tokens |
| saved | ${savedTokens.toLocaleString()} tokens (${savedPercent}%) |
| files | ${result.filesIncluded.length} |

conversation continues normally.`,
        };
      } else {
        return {
          success: false,
          type: 'error',
          error: `compaction failed: ${result.error || 'unknown'}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        type: 'error',
        error: `compaction error: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      sessionActions().setCompacting(false);
    }
  },
};

/**
 * /version - 显示版本信息
 */
export const versionCommand: SlashCommand = {
  name: 'version',
  aliases: ['v'],
  description: 'Show version info',
  category: 'general',
  usage: '/version',

  async handler(): Promise<SlashCommandResult> {
    // 从 package.json 获取版
    let version = 'unknown';
    try {
      const fs = await import('fs');
      const path = await import('path');
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      version = packageJson.version || 'unknown';
    } catch {
      // 忽略错
    }

    const content = `## AEGIS v${version}

runtime: ${process.version} · ${process.platform} ${process.arch}
`;

    return {
      success: true,
      type: 'info',
      content,
    };
  },
};

/**
 * /model - 显示或切换模型
 */
export const modelCommand: SlashCommand = {
  name: 'model',
  aliases: ['m'],
  description: 'Show, switch, add or remove models',
  category: 'config',
  usage: '/model [id] | /model add <id> <name> <model> <baseURL> <apiKey> | /model remove <id> | /model list',
  examples: ['/model', '/model claude-sonnet-4', '/model add mygpt gpt-4o gpt-4o https://api.openai.com/v1 sk-...', '/model remove mygpt'],
  fullDescription: 'Manage models. No args = interactive selector. add/remove = manage config.',

  async handler(args: string, context: SlashCommandContext): Promise<SlashCommandResult> {
    const state = getState();
    const config = state.config.config;
    const models = config?.models || [];
    const currentModelId = config?.currentModelId;
    const defaultModel = config?.default;

    const parts = args.trim().split(/\s+/);
    const subcommand = parts[0]?.toLowerCase();

    // ── /model add <id> <name> <model> <baseURL> <apiKey> ──
    if (subcommand === 'add') {
      const [, id, name, model, baseURL, apiKey] = parts;
      if (!id || !model || !baseURL) {
        return {
          success: false,
          type: 'error',
          content: 'usage: /model add <id> <name> <model> <baseURL> <apiKey>\nexample: /model add mygpt "GPT-4o" gpt-4o https://api.openai.com/v1 sk-...',
        };
      }
      if (models.find(m => m.id === id)) {
        return { success: false, type: 'error', content: `model id \`${id}\` already exists. remove it first.` };
      }
      const newModel = { id, name: name || id, model, baseURL, apiKey: apiKey || '', provider: 'openai-compatible' as const };
      const updatedModels = [...models, newModel];
      const { configActions } = await import('../store/index.js');
      configActions().updateConfig({ models: updatedModels });
      try {
        const fs = await import('fs');
        const path = await import('path');
        const os = await import('os');
        const cfgPath = path.join(os.homedir(), '.aegiscode', 'config.json');
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        cfg.models = updatedModels;
        fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
      } catch { /* non-fatal */ }
      return { success: true, type: 'success', message: `added model \`${id}\` (${model})` };
    }

    // ── /model remove <id> ──
    if (subcommand === 'remove' || subcommand === 'rm') {
      const id = parts[1];
      if (!id) return { success: false, type: 'error', content: 'usage: /model remove <id>' };
      if (!models.find(m => m.id === id)) {
        return { success: false, type: 'error', content: `model \`${id}\` not found` };
      }
      const updatedModels = models.filter(m => m.id !== id);
      const { configActions } = await import('../store/index.js');
      configActions().updateConfig({ models: updatedModels });
      try {
        const fs = await import('fs');
        const path = await import('path');
        const os = await import('os');
        const cfgPath = path.join(os.homedir(), '.aegiscode', 'config.json');
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        cfg.models = updatedModels;
        fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
      } catch { /* non-fatal */ }
      return { success: true, type: 'success', message: `removed model \`${id}\`` };
    }

    // ── /model list ──
    if (subcommand === 'list') {
      if (models.length === 0) return { success: true, type: 'info', content: 'no models configured.' };
      const lines = models.map(m =>
        `${m.id === currentModelId ? '▶' : ' '} \`${m.id}\` ${m.name || ''} (${m.model || ''})`
      );
      return { success: true, type: 'info', content: '## models\n\n' + lines.join('\n') };
    }

    // ── /model <id> — switch ──
    const trimmedArgs = args.trim();
    if (trimmedArgs && subcommand !== 'add' && subcommand !== 'remove' && subcommand !== 'list') {
      const targetModel = models.find(
        m => m.id === trimmedArgs || m.model === trimmedArgs || m.name === trimmedArgs
      );
      if (targetModel) {
        const { configActions } = await import('../store/index.js');
        configActions().updateConfig({ currentModelId: targetModel.id });
        try {
          const fs = await import('fs');
          const path = await import('path');
          const os = await import('os');
          const cfgPath = path.join(os.homedir(), '.aegiscode', 'config.json');
          const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
          cfg.currentModelId = targetModel.id;
          cfg.default = {
            ...cfg.default,
            model: targetModel.model || targetModel.id,
            baseURL: targetModel.baseURL || (targetModel as any).baseUrl || cfg.default?.baseURL,
            apiKey: targetModel.apiKey || cfg.default?.apiKey,
          };
          fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
        } catch { /* non-fatal */ }
        return { success: true, type: 'success', message: `model -> ${(targetModel as any).label || targetModel.name || targetModel.model || targetModel.id}` };
      }
      let errorContent = `unknown model: \`${trimmedArgs}\`\n\n`;
      if (models.length > 0) {
        errorContent += `available:\n` + models.map(m => `- \`${m.id}\` ${m.name || m.model || ''}`).join('\n');
      } else {
        errorContent += 'no models configured. use /model add to add one.';
      }
      return { success: false, type: 'error', content: errorContent };
    }

    // ── no args — interactive selector ──
    if (models.length === 0) {
      const modelInfo = defaultModel?.model || currentModelId || 'unknown';
      return { success: true, type: 'info', content: `## model\n\ncurrent: \`${modelInfo}\`\n\nno models configured. use /model add <id> <name> <model> <baseURL> <apiKey>` };
    }
    return {
      success: true,
      type: 'selector',
      selector: {
        title: 'Select model',
        options: models.map((m: any) => ({
          value: m.id,
          label: (m as any).label || m.name || m.model || m.id,
          description: m.model || m.baseURL || '',
          isCurrent: m.id === currentModelId,
        })),
        handler: 'model',
      },
    };
  },
};


/**
 * /theme - 切换主题
 */
export const themeCommand: SlashCommand = {
  name: 'theme',
  aliases: ['t'],
  description: 'Show or switch theme',
  category: 'config',
  usage: '/theme [theme-name]',
  examples: ['/theme', '/theme dark', '/theme ocean'],
  fullDescription: 'Show current theme or switch to a specified theme. Without args, opens interactive selector.',

  async handler(args: string): Promise<SlashCommandResult> {
    const { themeManager } = await import('../ui/themes/index.js');
    
    const trimmedArgs = args.trim().toLowerCase();
    const themePresets = themeManager.getThemePresets();
    const currentThemeName = themeManager.getCurrentThemeName();
    
    // 如果指定了主题名称，直接切
    if (trimmedArgs) {
      const targetTheme = themePresets.find(t => t.id === trimmedArgs || t.name.toLowerCase() === trimmedArgs);
      
      if (targetTheme) {
        themeManager.setTheme(targetTheme.id);
        return {
          success: true,
          type: 'success',
          message: `theme -> ${targetTheme.name}`,
        };
      }
      
      return {
        success: false,
        type: 'error',
        error: `unknown theme: ${trimmedArgs}\navailable: ${themePresets.map(t => t.id).join(', ')}`,
      };
    }
    
    // 无参数时，返回选择器配
    return {
      success: true,
      type: 'selector',
      selector: {
        title: 'Select theme',
        options: themePresets.map(t => ({
          value: t.id,
          label: t.name,
          description: t.description,
          isCurrent: t.id === currentThemeName || t.name === currentThemeName,
        })),
        handler: 'theme',
      },
    };
  },
};

/**
 * /status - 显示会话状态
 */
export const statusCommand: SlashCommand = {
  name: 'status',
  aliases: ['st'],
  description: 'Show session status',
  category: 'session',
  usage: '/status',

  async handler(): Promise<SlashCommandResult> {
    const state = getState();
    const { session, config } = state;
    const runtimeConfig = config.config;
    
    let content = `## status\n\n`;
    content += `| key | value |\n`;
    content += `|-----|-------|\n`;
    content += `| sid | \`${session.sessionId || 'N/A'}\` |\n`;
    content += `| messages | ${session.messages.length} |\n`;
    content += `| tokens in | ${session.tokenUsage.inputTokens} |\n`;
    content += `| tokens out | ${session.tokenUsage.outputTokens} |\n`;
    content += `| model | ${runtimeConfig?.currentModelId || 'N/A'} |\n`;
    content += `| thinking | ${session.isThinking ? 'yes' : 'no'} |\n`;
    
    return {
      success: true,
      type: 'info',
      content,
    };
  },
};

/**
 * /skills - Skills 管理
 */
export const skillsCommand: SlashCommand = {
  name: 'skills',
  aliases: ['sk'],
  description: 'List and manage skills',
  category: 'skills',
  usage: '/skills [name|refresh]',
  examples: ['/skills', '/skills commit-message', '/skills refresh'],
  fullDescription: 'List all available skills, view skill details, or refresh the skills list.',

  async handler(args: string): Promise<SlashCommandResult> {
    const { getSkillRegistry } = await import('../skills/index.js');
    const registry = getSkillRegistry();
    
    if (!registry.isInitialized()) {
      return {
        success: false,
        type: 'error',
        error: 'skills system not initialized',
      };
    }
    
    const trimmedArgs = args.trim().toLowerCase();
    
    // 刷
    if (trimmedArgs === 'refresh' || trimmedArgs === 'reload') {
      const result = await registry.refresh();
      
      let content = `## skills refreshed\n\n`;
      content += `loaded **${result.count}** skills: `;
      content += `${result.bySource.user} user · ${result.bySource.project} project · ${result.bySource.builtin} builtin\n`;
      
      if (result.errors.length > 0) {
        content += `\n### errors\n\n`;
        for (const err of result.errors) {
          content += `- \`${err.path}\`: ${err.error}\n`;
        }
      }
      
      return { success: true, type: 'success', content };
    }
    
    // 查看特定 Skill 详
    if (trimmedArgs && trimmedArgs !== 'list') {
      const skill = registry.getSkill(trimmedArgs);
      
      if (!skill) {
        const allSkills = registry.getAllSkills();
        const suggestions = allSkills
          .filter(s => s.name.includes(trimmedArgs) || s.description.toLowerCase().includes(trimmedArgs))
          .slice(0, 5);
        
        let errorContent = `unknown skill: \`${trimmedArgs}\`\n\n`;
        if (suggestions.length > 0) {
          errorContent += `similar:\n`;
          for (const s of suggestions) {
            errorContent += `- \`${s.name}\` ${s.description}\n`;
          }
        }
        
        return { success: false, type: 'error', content: errorContent };
      }
      
      // 显示 Skill 详
      let content = `## ${skill.name}\n\n`;
      content += `${skill.description}\n\n`;
      content += `| key | value |\n`;
      content += `|-----|-------|\n`;
      content += `| source | ${skill.source} |\n`;
      content += `| path | \`${skill.path}\` |\n`;
      content += `| invocable | ${skill.userInvocable ? 'yes' : 'no'} |\n`;
      content += `| no-model | ${skill.disableModelInvocation ? 'yes' : 'no'} |\n`;
      
      if (skill.allowedTools && skill.allowedTools.length > 0) {
        content += `| tools | ${skill.allowedTools.join(', ')} |\n`;
      }
      if (skill.whenToUse) {
        content += `\n### when to use\n\n${skill.whenToUse}\n`;
      }
      if (skill.argumentHint) {
        content += `\n### args\n\n${skill.argumentHint}\n`;
      }
      
      return { success: true, type: 'info', content };
    }
    
    // 列出所
    const allSkills = registry.getAllSkills();
    
    if (allSkills.length === 0) {
      return {
        success: true,
        type: 'info',
        content: `## skills\n\nno skills found.\n\nadd SKILL.md files to:\n- ~/.claude/skills/ (user)\n- ~/.aegis/skills/ (user)\n- .claude/skills/ (project)\n- .aegis/skills/ (project)`,
      };
    }
    
    // 按来源分
    const grouped: Record<string, typeof allSkills> = {
      builtin: [],
      user: [],
      project: [],
    };
    
    for (const skill of allSkills) {
      grouped[skill.source].push(skill);
    }
    
    let content = `## skills (${allSkills.length})\n\n`;
    
    // 内
    if (grouped.builtin.length > 0) {
      content += `### builtin\n\n`;
      for (const skill of grouped.builtin) {
        content += `- \`${skill.name}\` ${skill.description}\n`;
      }
      content += '\n';
    }
    
    // 用
    if (grouped.user.length > 0) {
      content += `### user\n\n`;
      for (const skill of grouped.user) {
        const tag = skill.userInvocable ? ' *' : '';
        content += `- \`${skill.name}\`${tag} ${skill.description}\n`;
      }
      content += '\n';
    }
    
    // 项
    if (grouped.project.length > 0) {
      content += `### project\n\n`;
      for (const skill of grouped.project) {
        const tag = skill.userInvocable ? ' *' : '';
        content += `- \`${skill.name}\`${tag} ${skill.description}\n`;
      }
      content += '\n';
    }
    
    content += `/skills <name> for details · * = invocable\n`;
    
    return { success: true, type: 'info', content };
  },
};

/**
 * /hooks - Hooks 管理
 */
export const hooksCommand: SlashCommand = {
  name: 'hooks',
  description: 'View and manage hooks',
  category: 'hooks',
  usage: '/hooks [status|list]',
  examples: ['/hooks', '/hooks status', '/hooks list'],
  fullDescription: 'View hooks configuration status and configured hook list.',

  async handler(args: string): Promise<SlashCommandResult> {
    const { getHookManager, HookEvent } = await import('../hooks/index.js');
    const manager = getHookManager();
    
    const trimmedArgs = args.trim().toLowerCase();
    
    // 显示状
    if (trimmedArgs === 'status' || trimmedArgs === '') {
      const enabled = manager.isEnabled();
      const counts = manager.getHookCounts();
      const totalHooks = Object.values(counts).reduce((a, b) => a + b, 0);
      const configuredEvents = manager.getConfiguredEvents();
      
      let content = `## hooks\n\n`;
      content += `| key | value |\n`;
      content += `|-----|-------|\n`;
      content += `| status | ${enabled ? 'enabled' : 'disabled'} |\n`;
      content += `| hooks | ${totalHooks} |\n`;
      content += `| events | ${configuredEvents.length} |\n`;
      
      if (totalHooks > 0) {
        content += `\n### by event\n\n`;
        for (const [event, count] of Object.entries(counts)) {
          content += `- **${event}** ${count}\n`;
        }
      }
      
      content += `/hooks list for full config\n`;
      
      return { success: true, type: 'info', content };
    }
    
    // 列出所有配
    if (trimmedArgs === 'list') {
      const config = manager.getConfig();
      const events = Object.values(HookEvent);
      
      let content = `## hooks config\n\n`;
      
      let hasAny = false;
      for (const event of events) {
        const matchers = config[event];
        if (!matchers || !Array.isArray(matchers) || matchers.length === 0) {
          continue;
        }
        
        hasAny = true;
        content += `### ${event}\n\n`;
        
        for (const matcher of matchers) {
          const name = matcher.name || '(unnamed)';
          content += `**${name}**\n`;
          
          if (matcher.matcher) {
            if (matcher.matcher.tools) {
              content += `- tools: \`${matcher.matcher.tools}\`\n`;
            }
            if (matcher.matcher.paths) {
              content += `- paths: \`${matcher.matcher.paths}\`\n`;
            }
            if (matcher.matcher.commands) {
              content += `- commands: \`${matcher.matcher.commands}\`\n`;
            }
          }
          
          content += `- hooks: ${matcher.hooks?.length || 0}\n`;
          content += '\n';
        }
      }
      
      if (!hasAny) {
        content += `no hooks configured.\n\n`;
        content += `add hooks to settings.json:\n`;
        content += `- ~/.aegis/settings.json (user)\n`;
        content += `- .aegis/settings.json (project)\n`;
      }
      
      return { success: true, type: 'info', content };
    }
    
    return {
      success: false,
      type: 'error',
      error: `unknown subcommand: ${trimmedArgs}\navailable: status, list`,
    };
  },
};

/**
 * Helper: copy text to clipboard
 */
async function copyToClipboard(text: string): Promise<void> {
  const { execSync } = await import('child_process');
  const platform = process.platform;
  if (platform === 'darwin') {
    execSync('pbcopy', { input: text });
  } else if (platform === 'linux') {
    try {
      execSync('xclip -selection clipboard', { input: text });
    } catch {
      execSync('xsel --clipboard --input', { input: text });
    }
  } else if (platform === 'win32') {
    execSync('clip', { input: text });
  } else {
    throw new Error(`unsupported platform: ${platform}`);
  }
}

/**
 * /copy - 复制代码块或文本到剪贴板
 *
 * /copy                    — kopiera senaste kodblocket
 * /copy N                  — kopiera kodblock N från slutet
 * /copy list               — lista alla kodblock
 * /copy last               — kopiera senaste assistent-svaret (plain text)
 * /copy raw <N|last>       — som ovan, men skriv ut i terminalen för manuell kopiering
 */
export const copyCommand: SlashCommand = {
  name: 'copy',
  aliases: ['cp'],
  description: 'Copy code block or text to clipboard — /copy | /copy N | /copy last | /copy list',
  category: 'general',
  usage: '/copy [n | last | list | raw]',
  examples: ['/copy', '/copy 2', '/copy last', '/copy list', '/copy raw'],
  fullDescription: `Copy code blocks or assistant responses to clipboard.

/copy         — copy the last code block to clipboard
/copy N       — copy code block N from end (1=last)
/copy last    — copy the last assistant response as plain text (markdown stripped)
/copy list    — show all code blocks with index
/copy raw     — print the last assistant response as plain text in terminal for manual copy
/copy raw N   — print assistant response N from end as plain text`,

  async handler(args: string): Promise<SlashCommandResult> {
    const state = getState();
    const messages = state.session.messages;

    const { parseMarkdown } = await import('../ui/components/markdown/parser.js');

    const trimmedArgs = args.trim().toLowerCase();

    // === /copy raw — skriv ut plain text direkt till stdout (förbi Ink) ===
    if (trimmedArgs === 'raw' || trimmedArgs.startsWith('raw ')) {
      const parts = trimmedArgs.split(' ');
      let n = 1;
      if (parts.length > 1 && parts[1]) {
        const parsed = parseInt(parts[1], 10);
        if (!isNaN(parsed) && parsed > 0) n = parsed;
      }
      const assistantMsgs = messages.filter(m => m.role === 'assistant');
      if (assistantMsgs.length === 0) {
        return { success: false, type: 'error', error: 'no assistant messages' };
      }
      const idx = assistantMsgs.length - n;
      if (idx < 0) {
        return { success: false, type: 'error', error: `only ${assistantMsgs.length} assistant messages` };
      }
      const target = assistantMsgs[idx];

      // Strip markdown: return only the text content
      const { stripMarkdown } = await import('../ui/components/markdown/parser.js');
      const blocks = parseMarkdown(target.content);
      const textParts = blocks.map(b => {
        if (b.type === 'empty') return '';
        if (b.type === 'code') return b.content;
        if (b.type === 'heading') return b.content;
        if (b.type === 'list') return `${b.marker || '•'} ${b.content}`;
        return b.content;
      }).filter(Boolean);
      const plainText = textParts.map(t => stripMarkdown(t)).join('\n\n');

      // Write directly to stdout to bypass Ink rendering
      const separator = '─'.repeat(60);
      process.stdout.write(`\n${separator}\n`);
      process.stdout.write(`/copy raw — assistant message #${n} (pure text, can copy below)\n`);
      process.stdout.write(`${separator}\n\n`);
      process.stdout.write(plainText);
      process.stdout.write(`\n\n${separator}\n\n`);

      return { success: true, type: 'silent' };
    }

    // === /copy last — kopiera senaste assistent-svaret som plain text ===
    if (trimmedArgs === 'last') {
      const assistantMsgs = messages.filter(m => m.role === 'assistant');
      if (assistantMsgs.length === 0) {
        return { success: false, type: 'error', error: 'no assistant messages' };
      }
      const target = assistantMsgs[assistantMsgs.length - 1];

      // Extract text content (strip markdown)
      const { stripMarkdown } = await import('../ui/components/markdown/parser.js');
      const blocks = parseMarkdown(target.content);
      const textParts = blocks.map(b => {
        if (b.type === 'empty') return '';
        if (b.type === 'code') return b.content;
        return b.content;
      }).filter(Boolean);
      const plainText = textParts.map(t => stripMarkdown(t)).join('\n\n');

      try {
        await copyToClipboard(plainText);
        const lines = plainText.split('\n').length;
        const preview = plainText.slice(0, 60);
        return {
          success: true,
          type: 'success',
          message: `copied assistant reply (${lines}L) · ${preview}${preview.length >= 60 ? '...' : ''}`,
        };
      } catch (err) {
        return {
          success: false,
          type: 'error',
          error: `clipboard: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    // === Extract all code blocks from messages ===
    const codeBlocks: Array<{ content: string; language?: string; filePath?: string }> = [];

    for (const msg of messages) {
      if (!msg.content) continue;
      const blocks = parseMarkdown(msg.content);
      for (const block of blocks) {
        if (block.type === 'code' && block.content.trim()) {
          codeBlocks.push({
            content: block.content,
            language: block.language,
            filePath: block.filePath,
          });
        }
      }
    }

    if (codeBlocks.length === 0) {
      return {
        success: false,
        type: 'error',
        error: 'no code blocks in conversation',
      };
    }

    // /copy list - show all blocks
    if (trimmedArgs === 'list' || trimmedArgs === 'ls') {
      let content = `${codeBlocks.length} code blocks (newest first)\n\n`;
      for (let i = codeBlocks.length - 1; i >= 0; i--) {
        const n = codeBlocks.length - i;
        const b = codeBlocks[i];
        const label = b.filePath || b.language || 'code';
        const lines = b.content.split('\n').length;
        const preview = b.content.split('\n')[0].slice(0, 50);
        content += `  ${n}. ${label} (${lines}L) ${preview}${preview.length >= 50 ? '...' : ''}\n`;
      }
      content += `\nuse /copy N to copy a block · /copy last for assistant reply`;
      return { success: true, type: 'info', content };
    }

    // Determine which block to copy
    let targetIndex: number;

    if (!trimmedArgs) {
      targetIndex = codeBlocks.length - 1;
    } else {
      const n = parseInt(trimmedArgs, 10);
      if (isNaN(n) || n < 1) {
        return {
          success: false,
          type: 'error',
          error: `invalid: ${trimmedArgs}. use /copy [N], /copy last, /copy list, or /copy raw`,
        };
      }
      targetIndex = codeBlocks.length - n;
      if (targetIndex < 0) {
        return {
          success: false,
          type: 'error',
          error: `only ${codeBlocks.length} blocks. use /copy list`,
        };
      }
    }

    const target = codeBlocks[targetIndex];

    // Copy to clipboard
    try {
      await copyToClipboard(target.content);
    } catch (err) {
      return {
        success: false,
        type: 'error',
        error: `clipboard: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Build confirmation
    const lines = target.content.split('\n').length;
    const label = target.filePath || target.language || 'code';
    const preview = target.content.split('\n')[0].slice(0, 50);
    const hint = codeBlocks.length > 1 ? ` · ${codeBlocks.length} blocks, /copy list` : '';

    return {
      success: true,
      type: 'success',
      message: `copied ${label} (${lines}L) · ${preview}${preview.length >= 50 ? '...' : ''}${hint}`,
    };
  },
};

/**
 * /thinking - 切换思考块展开/折叠
 */
export const thinkingCommand: SlashCommand = {
  name: 'thinking',
  description: 'Toggle thinking blocks expand/collapse',
  category: 'config',
  usage: '/thinking',
  fullDescription: 'Toggle global expand/collapse for all thinking blocks in messages.',

  async handler(): Promise<SlashCommandResult> {
    const { appActions, getState } = await import('../store/index.js');
    appActions().toggleShowAllThinking();
    
    const expanded = getState().app.showAllThinking;
    return {
      success: true,
      type: 'success',
      message: `thinking blocks: ${expanded ? 'expanded' : 'collapsed'}`,
    };
  },
};

/**
 * 
 */


const multiCommand: SlashCommand = {
  name: 'multi',
  description: 'Orchestrate multiple AI agents on a complex task — /multi <task>',
  category: 'general',
  usage: '/multi <task>',
  examples: ['/multi Refactor the auth module to use JWT', '/multi Review the codebase for security issues'],
  fullDescription: `Spawns up to 4 specialist agents in parallel:
- architect   — analyzes structure & design patterns
- implementer — writes production-ready code
- reviewer    — checks for bugs & security issues
- debugger    — diagnoses errors systematically

All agents run concurrently, then results are synthesized.`,

  async handler(args: string, _context: SlashCommandContext): Promise<SlashCommandResult> {
    const task = args?.trim();
    if (!task) return { success: false, type: 'error', error: 'Usage: /multi <task>' };

    // Robust model resolution — fallback chain: store → configManager → env
    let currentModel = getCurrentModel();
    if (!currentModel) {
      const { configManager } = await import('../config/ConfigManager.js');
      await configManager.initialize().catch(() => {});
      currentModel = configManager.getDefaultModel() as any;
    }
    const config = getConfig();
    const defaultCfg = (config?.default || {}) as Record<string, string | undefined>;

    const model = (currentModel as any)?.model || (currentModel as any)?.id || defaultCfg.model || process.env.OPENAI_MODEL || '';
    const baseURL = (currentModel as any)?.baseURL || defaultCfg.baseURL || process.env.OPENAI_BASE_URL || '';
    let apiKey = (currentModel as any)?.apiKey || defaultCfg.apiKey || '';
    const bu = baseURL.toLowerCase();
    if (!apiKey) {
      if (bu.includes('anthropic'))         apiKey = process.env.ANTHROPIC_API_KEY || '';
      else if (bu.includes('deepseek'))     apiKey = process.env.DEEPSEEK_API_KEY || '';
      else if (bu.includes('groq'))         apiKey = process.env.GROQ_API_KEY || '';
      else if (bu.includes('openai'))       apiKey = process.env.OPENAI_API_KEY || '';
      else                                  apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY || '';
    }
    if (!apiKey) apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY || '';

    if (!apiKey) {
      return { success: false, type: 'error', error: 'No API key configured. Add DEEPSEEK_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, or ANTHROPIC_API_KEY to ~/.aegiscode/.env' };
    }

    // If Anthropic key fails (e.g. zero balance), fall back to the next available key
    if (baseURL.toLowerCase().includes('anthropic') && !process.env.ANTHROPIC_API_KEY) {
      apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || '';
    }

    const modelConfig = { model, baseURL: baseURL || undefined, apiKey };

    try {
      const orchestrator = createDefaultOrchestrator(modelConfig);

      const subTasks: Record<string, string> = {
        architect: `Analyze the following task from an architectural perspective.\nEvaluate code structure, dependencies, design patterns, and potential refactoring.\nProvide specific file paths and recommendations.\n\nTask: ${task}`,
        implementer: `Implement the following task.\nWrite clean, production-ready code following existing patterns.\nProvide complete code blocks with file paths.\n\nTask: ${task}`,
        reviewer: `Review the approach for the following task.\nCheck for potential bugs, security issues, type safety, and performance concerns.\nBe critical but constructive.\n\nTask: ${task}`,
        debugger: `Analyze potential issues and edge cases for the following task.\nIdentify failure modes, error handling gaps, and testing considerations.\n\nTask: ${task}`,
      };

      const result = await orchestrator.orchestrate(task, subTasks, 'reviewer');
      const lines: string[] = [];
      lines.push('## ⬡ Multi-Agent Orchestration');
      lines.push(`**Task:** ${task}`);
      lines.push('');

      for (const response of result.responses) {
        const icon = response.agentName === 'architect' ? '🏗'
          : response.agentName === 'implementer' ? '⚙'
          : response.agentName === 'reviewer' ? '🔍'
          : '🐛';
        lines.push(`### ${icon} ${response.agentName.charAt(0).toUpperCase() + response.agentName.slice(1)}`);
        lines.push('');
        lines.push(response.content || '*No response*');
        if (response.metadata?.durationMs) {
          lines.push(`\n*(${response.metadata.durationMs}ms)*`);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('### 📋 Synthesized Summary');
      lines.push('');
      lines.push(result.summary);
      lines.push('');
      lines.push(`*${result.metadata.agentsUsed} agents · ${(result.metadata.totalDurationMs / 1000).toFixed(1)}s total*`);

      return { success: true, type: 'info', content: lines.join('\n') };
    } catch (error) {
      return {
        success: false,
        type: 'error',
        error: `/multi failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

const researchCommand: SlashCommand = {
  name: 'research',
  description: 'Research a topic using multi-agent deliberation — /research <question>',
  category: 'general',
  usage: '/research <question>',
  examples: ['/research What are the tradeoffs of using WebSockets vs SSE?', '/research Compare PostgreSQL and SQLite for a CLI tool'],
  fullDescription: `Spawns a research council of AI agents with different perspectives:
- Analyst      — data-driven, empirical perspective
- Architect    — systems & design tradeoffs
- Ethicist     — safety, fairness, and societal impact
- Pragmatist   — practical, implemention-focused

Agents deliberate in parallel, then results are aggregated.`,

  async handler(args: string, _context: SlashCommandContext): Promise<SlashCommandResult> {
    const question = args?.trim();
    if (!question) return { success: false, type: 'error', error: 'Usage: /research <question>' };

    // Robust model resolution — fallback chain: store → configManager → env
    let currentModel2 = getCurrentModel();
    if (!currentModel2) {
      const { configManager } = await import('../config/ConfigManager.js');
      await configManager.initialize().catch(() => {});
      currentModel2 = configManager.getDefaultModel() as any;
    }
    const config2 = getConfig();
    const defaultCfg2 = (config2?.default || {}) as Record<string, string | undefined>;

    const model = (currentModel2 as any)?.model || (currentModel2 as any)?.id || defaultCfg2.model || process.env.OPENAI_MODEL || '';
    const baseURL = (currentModel2 as any)?.baseURL || defaultCfg2.baseURL || process.env.OPENAI_BASE_URL || '';
    let apiKey = (currentModel2 as any)?.apiKey || defaultCfg2.apiKey || '';
    if (!apiKey) {
      const bu = baseURL.toLowerCase();
      if (bu.includes('anthropic'))         apiKey = process.env.ANTHROPIC_API_KEY || '';
      else if (bu.includes('deepseek'))     apiKey = process.env.DEEPSEEK_API_KEY || '';
      else if (bu.includes('groq'))         apiKey = process.env.GROQ_API_KEY || '';
      else if (bu.includes('openai'))       apiKey = process.env.OPENAI_API_KEY || '';
      else                                  apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY || '';
    }
    if (!apiKey) apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY || '';

    if (!apiKey) {
      return { success: false, type: 'error', error: 'No API key configured. Add DEEPSEEK_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, or ANTHROPIC_API_KEY to ~/.aegiscode/.env' };
    }

    // If Anthropic key fails (e.g. zero balance), fall back to the next available key
    if (baseURL.toLowerCase().includes('anthropic') && !process.env.ANTHROPIC_API_KEY) {
      apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || '';
    }

    const modelConfig = { model, baseURL: baseURL || undefined, apiKey };

    try {
      const council = new CouncilAgent('research-council', modelConfig, {
        rule: 'majority',
        maxTokensPerAgent: 400,
        enableIteration: false,
      });

      council.addMember('analyst', 'Data Analyst',
        `You are a Data Analyst on a research council. You reason from data, statistics, and empirical evidence.\nYou value measurable outcomes and quantitative reasoning.\nAlways state VOTE: approve, reject, or abstain and REASONING: with data-driven justification.`,
        1, { model: modelConfig.model, baseURL: modelConfig.baseURL || undefined, apiKey: modelConfig.apiKey });

      council.addMember('architect', 'Systems Architect',
        `You are a Systems Architect on a research council. You evaluate designs, tradeoffs, and architectural decisions.\nYou focus on scalability, maintainability, and system coherence.\nAlways state VOTE: approve, reject, or abstain and REASONING: with architectural justification.`,
        1, { model: modelConfig.model, baseURL: modelConfig.baseURL || undefined, apiKey: modelConfig.apiKey });

      council.addMember('ethicist', 'Ethics & Safety Officer',
        `You are an Ethics & Safety Officer on a research council. You evaluate safety, fairness, privacy, and societal impact.\nYou raise concerns others might miss and advocate for responsible practices.\nAlways state VOTE: approve, reject, or abstain and REASONING: with ethical justification.`,
        1, { model: modelConfig.model, baseURL: modelConfig.baseURL || undefined, apiKey: modelConfig.apiKey });

      council.addMember('pragmatist', 'Pragmatic Engineer',
        `You are a Pragmatic Engineer on a research council. You evaluate practicality, implementation effort, and real-world constraints.\nYou balance idealism with what actually works in production.\nAlways state VOTE: approve, reject, or abstain and REASONING: with practical justification.`,
        1, { model: modelConfig.model, baseURL: modelConfig.baseURL || undefined, apiKey: modelConfig.apiKey });

      const result = await council.deliberate(question);

      // Build research-focused output (not vote-centric)
      const lines: string[] = [];
      lines.push('## ⬡ AEGIS Research Council');
      lines.push(`**Question:** ${question}`);
      lines.push('');
      for (const v of result.voteResults) {
        lines.push(`### ${v.role}`);
        lines.push(v.reasoning);
        lines.push('');
      }
      lines.push('---');
      lines.push('### Synthesis');
      lines.push('');
      // Extract synthesis from summary (after the vote table)
      const summaryLines = result.summary.split('\n');
      const verdictIdx = summaryLines.findIndex(l => l.includes('APPROVED') || l.includes('REJECTED'));
      const synthesis = verdictIdx > -1
        ? summaryLines.slice(verdictIdx + 1).join('\n').trim()
        : result.summary;
      lines.push(synthesis || `${result.voteResults.length} perspectives gathered.`);
      lines.push('');
      lines.push(`*${result.voteResults.length} agents · ${result.rounds} round(s)*`);

      return { success: true, type: 'info', content: lines.join('\n') };
    } catch (error) {
      return {
        success: false,
        type: 'error',
        error: `/research failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

const billingCommand: SlashCommand = {
  name: 'billing',
  description: 'Show subscription and billing info',
  category: 'config',
  usage: '/billing',
  async handler(args: string): Promise<SlashCommandResult> {
    const { runBilling } = await import('./billing.js');
    const result = await runBilling(args);
    return { success: true, type: 'info', content: result };
  },
};

const memoryCommand: SlashCommand = {
  name: 'memory',
  description: 'View or manage semantic memory — /memory activate <token> | /memory load <url|path> | /memory clear | /memory stats',
  category: 'config',
  usage: '/memory [activate <token> | load <url|path> | clear | stats]',
  async handler(args: string): Promise<SlashCommandResult> {
    const fs   = await import('fs');
    const path = await import('path');
    const os   = await import('os');
    const { exec } = await import('child_process');
    const { sharedMemory } = await import('../memory/SharedMemory.js');

    const cfgPath = path.join(os.homedir(), '.aegiscode', 'config.json');
    let cfg: any = {};
    try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
    const mem        = cfg?.memory ?? {};
    const subscribed = mem.subscribed === true || Boolean(process.env.AEGIS_MEMORY_TOKEN);

    // /memory activate <token>
    if (args?.startsWith('activate ')) {
      const token = args.replace('activate ', '').trim();
      if (token.length < 20) {
        return { success: false, type: 'error', error: 'Invalid token format — must be a valid signed JWT from Stripe checkout' };
      }

      // Verify token against aegiscloud.org
      const verifyUrl = cfg?.memory?.verifyUrl || process.env.AEGIS_VERIFY_URL || 'https://aegiscloud.org/api/verify-token';
      const apiKey = cfg?.aegiscloud?.api_key || process.env.AEGISCLOUD_API_KEY || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['X-API-Key'] = apiKey;
      try {
        const res = await fetch(verifyUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ token }),
        });
        const result = await res.json();

        if (!result.valid) {
          return { success: false, type: 'error', error: `Token verification failed: ${result.error || 'invalid token'}` };
        }

        cfg.memory = {
          ...mem,
          subscribed: true,
          token,
          activatedAt: new Date().toISOString(),
          verifiedEmail: result.email || 'unknown',
          plan: result.plan || 'semantic-memory',
          expiresAt: result.expiresAt || null,
        };
        fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
        return { success: true, type: 'success', message: `✓ Memory activated — semantic search enabled (${result.email})` };
      } catch (e: any) {
        // Fallback: allow offline activation with env var set
        if (process.env.AEGIS_MEMORY_TOKEN === token) {
          cfg.memory = { ...mem, subscribed: true, token, activatedAt: new Date().toISOString() };
          fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
          return { success: true, type: 'success', message: '✓ Memory activated (offline mode — set AEGIS_MEMORY_TOKEN)' };
        }
        return { success: false, type: 'error', error: `Cannot verify token: ${e.message}. Set AEGIS_MEMORY_TOKEN in .env for offline activation.` };
      }
    }

    // /memory load <url|path> — load aegis export into local memory
    if (args?.startsWith('load ')) {
      const target = args.replace('load ', '').trim();
      try {
        let data: any;
        if (target.startsWith('http')) {
          const apiKey = cfg?.apiKey || '';
          const { default: nodeFetch } = await import('node-fetch' as any).catch(() => ({ default: fetch }));
          const fetchFn: any = nodeFetch || fetch;
          const res = await fetchFn(target, { headers: apiKey ? { 'X-API-Key': apiKey } : {} });
          data = await res.json();
        } else {
          data = JSON.parse(fs.readFileSync(target, 'utf8'));
        }
        const convs = data.conversations || data;
        if (!Array.isArray(convs) && !convs.length) {
          return { success: false, type: 'error', error: 'No conversations found in export' };
        }
        const memDir  = path.join(os.homedir(), '.aegiscode', 'memory');
        const memFile = path.join(memDir, 'shared.json');
        try { fs.mkdirSync(memDir, { recursive: true }); } catch {}
        let existing: any[] = [];
        try { existing = JSON.parse(fs.readFileSync(memFile, 'utf8')); } catch {}
        const newEntries = (Array.isArray(convs) ? convs : convs.conversations || []).map((c: any) => ({
          id:        c.id || Math.random().toString(36).slice(2),
          content:   c.content || '',
          role:      'assistant',
          source:    c.source || 'aegiscloud',
          timestamp: c.created_at || new Date().toISOString(),
          tags:      [c.source || 'aegiscloud'],
          sessionId: 'imported',
          title:     c.title || 'Untitled',
        }));
        const merged = [...existing, ...newEntries];
        fs.writeFileSync(memFile, JSON.stringify(merged, null, 2));
        return { success: true, type: 'success', message: `✓ Loaded ${newEntries.length} conversations into memory (${merged.length} total)` };
      } catch (e: any) {
        return { success: false, type: 'error', error: `Load failed: ${e.message}` };
      }
    }

    // /memory clear
    if (args?.trim() === 'clear') {
      if (!subscribed) return { success: false, type: 'error', error: 'Not subscribed' };
      sharedMemory.clear();
      cfg.memory = { ...mem, lastCleared: new Date().toISOString() };
      fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
      return { success: true, type: 'success', message: 'Memory cleared' };
    }

    // /memory stats
    if (args?.trim() === 'stats') {
      if (!subscribed) return { success: false, type: 'error', error: 'Not subscribed' };
      const stats = sharedMemory.getStats();
      return {
        success: true,
        type: 'info',
        content: [
          '## ⬡ AEGIS Memory Statistics',
          '',
          `**Total Entries:** ${stats.total}`,
          `**Sessions:** ${stats.sessions}`,
          `**Summaries:** ${stats.summaries}`,
          `**Avg Importance:** ${stats.avgImportance}`,
          `**Status:** ${stats.enabled ? '✓ Enabled' : '✗ Disabled'}`,
        ].join('\n'),
      };
    }

    // Ej prenumerant — öppna Stripe
    if (!subscribed) {
      const stripeUrl = 'https://buy.stripe.com/14A4gB4J53vxcaV74S9R601';
      exec(`xdg-open "${stripeUrl}"`, () => {});
      return {
        success: true,
        type: 'info',
        content: [
          '## ⬡ AEGIS Semantic Memory',
          '',
          '**Status:** Inactive',
          '',
          'Semantic memory stores and retrieves context across sessions.',
          'Price: **$2/month** via Stripe.',
          '',
          `Opening payment page...`,
          `  ${stripeUrl}`,
          '',
          'After payment you receive a token via email / success page.',
          'Activate with:',
          '  `/memory activate <token>`',
          '',
          'Tokens are verified against AEGIS Stripe webhook server.',
          'Offline activation: set `AEGIS_MEMORY_TOKEN` in `.env`.',
        ].join('\n'),
      };
    }

    // Prenumerant — visa status
    const stats = sharedMemory.getStats();
    const recent = sharedMemory.recent(3);

    const lines = [
      '## ⬡ AEGIS Memory',
      '',
      '**Status:** ✓ Active — Cross-session semantic memory enabled',
      `  ${stats.total} memories stored across ${stats.sessions} sessions`,
      `  ${stats.summaries} session summaries`,
    ];
    if (mem.activatedAt) lines.push(`  Activated: ${mem.activatedAt.slice(0, 10)}`);
    if (recent.length > 0) {
      lines.push('  Recent:');
      recent.slice(-3).reverse().forEach((e: any) => {
        lines.push(`  [${e.source ?? 'aegis-cli'} · ${(e.timestamp ?? '').slice(0, 10)}]`);
        lines.push(`  ${(e.content ?? '').slice(0, 100)}`);
      });
    }
    lines.push('', '`/memory clear` — wipe all memories');

    return { success: true, type: 'info', content: lines.join('\n') };
  },
};

const councilCommand: SlashCommand = {
  name: 'council',
  description: 'Submit a question to Claude, DeepSeek and Llama for majority vote',
  category: 'config',
  usage: '/council <question>',
  async handler(args: string): Promise<SlashCommandResult> {
    const question = args?.trim();
    if (!question) return { success: false, type: 'error', error: 'Usage: /council <question>' };
    const { runCouncil } = await import('./council.js');
    const result = await runCouncil(question);
    return { success: true, type: 'info', content: result };
  },
};


const cloudCommand: SlashCommand = {
  name: 'cloud',
  description: 'Manage AEGIS Cloud sync (aegiscloud.org)',
  category: 'config',
  usage: '/cloud [status | key <api_key> | sync on|off]',
  fullDescription: 'Connect aegis-cli to aegiscloud.org. Conversations are uploaded automatically on exit.',
  async handler(args: string): Promise<SlashCommandResult> {
    const fs   = await import('fs');
    const path = await import('path');
    const os   = await import('os');

    const cfgPath = path.join(os.homedir(), '.aegiscode', 'config.json');
    let cfg: any = {};
    try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
    const cloud = cfg?.aegiscloud ?? {};
    const trimmed = (args ?? '').trim();

    // /cloud key <api_key>
    if (trimmed.startsWith('key ')) {
      const apiKey = trimmed.replace('key ', '').trim();
      if (apiKey.length < 16) return { success: false, type: 'error', error: 'API key too short' };
      cfg.aegiscloud = { ...cloud, api_key: apiKey, syncConversations: true };
      fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
      return {
        success: true,
        type: 'success',
        message: '✓ AEGIS Cloud key saved — conversations will sync on exit',
      };
    }

    // /cloud sync on|off
    if (trimmed === 'sync on' || trimmed === 'sync off') {
      const enable = trimmed === 'sync on';
      cfg.aegiscloud = { ...cloud, syncConversations: enable };
      fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
      return {
        success: true,
        type: 'success',
        message: `Conversation sync: ${enable ? '✓ enabled' : '✗ disabled'}`,
      };
    }

    // /cloud status (default)
    const hasKey   = !!cloud.api_key;
    const doSync   = cloud.syncConversations !== false;
    const maskedKey = hasKey
      ? cloud.api_key.slice(0, 6) + '...' + cloud.api_key.slice(-4)
      : '—';

    const lines = [
      '## ⬡ AEGIS Cloud',
      '',
      `**API Key:**  ${maskedKey}`,
      `**Sync:**     ${doSync && hasKey ? '✓ enabled' : '✗ disabled'}`,
      `**Endpoint:** https://aegiscloud.org/api/conversations`,
      '',
    ];

    if (!hasKey) {
      lines.push('Connect your account:');
      lines.push('  1. Log in at https://aegiscloud.org');
      lines.push('  2. Copy your API key from Settings');
      lines.push('  3. Run: `/cloud key <your_api_key>`');
    } else {
      lines.push('Commands:');
      lines.push('  `/cloud sync on`  — enable auto-upload on exit');
      lines.push('  `/cloud sync off` — disable auto-upload');
      lines.push('  `/cloud key <k>`  — update API key');
    }

    return { success: true, type: 'info', content: lines.join('\n') };
  },
};


const yoloCommand: SlashCommand = {
  name: 'yolo',
  description: 'Toggle YOLO mode — auto-approve all tool executions',
  category: 'config',
  usage: '/yolo [on|off]',
  async handler(args: string): Promise<SlashCommandResult> {
    const { getState, configActions } = await import('../store/index.js');
    const state = getState();
    const current = state.config.config?.defaultPermissionMode === 'yolo';
    const arg = args.trim().toLowerCase();

    const enable = arg === 'on' ? true : arg === 'off' ? false : !current;

    try {
      const fs   = await import('fs');
      const path = await import('path');
      const os   = await import('os');
      const cfgPath = path.join(os.homedir(), '.aegiscode', 'config.json');
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      cfg.defaultPermissionMode = enable ? 'yolo' : 'default';
      fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
    } catch {}

    if (enable) {
      return {
        success: true,
        type: 'info',
        content: [
          '## ⚠ YOLO Mode ENABLED',
          '',
          'Claude will execute ALL tool calls without confirmation.',
          'This includes file writes, bash commands, and network requests.',
          '',
          'Run `/yolo off` to disable.',
        ].join('\n'),
      };
    }

    return {
      success: true,
      type: 'success',
      message: '✓ YOLO mode disabled — confirmations restored',
    };
  },
};

export const builtinCommands: SlashCommand[] = [
  helpCommand,
  clearCommand,
  compactCommand,
  versionCommand,
  modelCommand,
  themeCommand,
  statusCommand,
  skillsCommand,
  hooksCommand,
  thinkingCommand,
  copyCommand,
  memoryCommand,
  councilCommand,
  billingCommand,
  yoloCommand,
  multiCommand,
  researchCommand,
];
