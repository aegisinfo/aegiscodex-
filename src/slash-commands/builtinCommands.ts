/**
 * Built-in slash commands
 */

import type { SlashCommand, SlashCommandResult, SlashCommandContext } from './types.js';
import type { AgentConfig } from '../agent/types.js';
import { buildCommand } from './build.js';
import { cloneCommand } from './clone.js';
import { debateCommand } from './debate.js';
import { sessionActions, getState, getConfig } from '../store/index.js';
import {
  OrchestratorAgent,
  CouncilAgent,
  requireModelConfig,
  buildSourceContext,
  createBuiltinApps,
  runApp,
  getApp,
  getRegisteredApps,
  AppBuilder,
  type AppDefinition,
  type SubAgentConfig,
} from '../agent/orchestrator/index.js';
import { getOllamaModels, isLocalOllamaUrl, type OllamaModelInfo } from '../services/OllamaInstaller.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { exec } from 'child_process';

// ─── Auto-register AppBuilder apps ───
const BUILTIN_APPS: AppDefinition[] = createBuiltinApps();

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
  description: 'Compact context / rate compactions / show betterment',
  category: 'session',
  usage: '/compact [/compact rate <1-5> [note] | /compact betterment]',
  fullDescription: `Trigger manual context compaction, summarizing conversation history to save tokens.
Sub-commands:
  /compact                        — compact context now
  /compact rate <1-5> [note]      — rate the last compaction (helps improve future ones)
  /compact betterment             — show compaction quality report, stats, and suggestions`,

  async handler(_args: string, context: SlashCommandContext): Promise<SlashCommandResult> {
    const { contextManager, chatService, modelName } = context;
    
    if (!contextManager) {
      return {
        success: false,
        type: 'error',
        error: 'context manager unavailable',
      };
    }

    // ── Sub-command: /compact betterment ───────────────────────────────
    if (_args.trim().toLowerCase() === 'betterment') {
      const { betterment } = await import('../context/BettermentService.js');
      const report = betterment.getAdaptiveReport();
      return {
        success: true,
        type: 'success',
        content: report,
      };
    }

    // ── Sub-command: /compact rate <1-5> [note] ───────────────────────
    const rateMatch = _args.trim().match(/^rate\s+(\d+)(?:\s+(.+))?$/i);
    if (rateMatch) {
      const { betterment } = await import('../context/BettermentService.js');
      const rating = parseInt(rateMatch[1], 10);
      const note = rateMatch[2] || undefined;
      if (rating < 1 || rating > 5) {
        return {
          success: false,
          type: 'error',
          error: 'rating must be between 1 and 5',
        };
      }
      const ok = betterment.rateLastCompaction(rating, note);
      if (!ok) {
        return {
          success: true,
          type: 'info',
          message: 'no unrated compaction to rate, or already rated. Use /compact betterment to see history.',
        };
      }
      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
      return {
        success: true,
        type: 'success',
        content: `Compaction rated ${stars} (${rating}/5)${note ? ` — "${note}"` : ''}. Thank you — this helps improve future compactions.`,
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
        modelName: modelName || 'claude-sonnet-4-6',
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
        const { configActions, appActions } = await import('../store/index.js');
        configActions().updateConfig({ currentModelId: targetModel.id });
        // A manual pick wins over the auto-router for the rest of the session
        appActions().setManualModelOverride(true);
        appActions().setAutoRouterActiveModel(null);
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
    const OLLAMA_DEFAULT = 'http://localhost:11434/v1';

    // Always scan local Ollama (even if no Ollama models are configured yet)
    const ollamaInfoByName = new Map<string, OllamaModelInfo>();
    const ollamaBaseURLs = [...new Set([
      OLLAMA_DEFAULT,
      ...models
        .filter((m: any) => isLocalOllamaUrl(m.baseURL || m.baseUrl))
        .map((m: any) => m.baseURL || m.baseUrl),
    ])];
    await Promise.all(
      ollamaBaseURLs.map(async (url: string) => {
        const infos = await getOllamaModels(url).catch(() => []);
        for (const info of infos) {
          ollamaInfoByName.set(info.name, info);
          ollamaInfoByName.set(info.name.split(':')[0], info);
        }
      })
    );

    // Build configured model entries
    const configuredIds = new Set(models.map((m: any) => m.model || m.id));
    const configuredOptions = models.map((m: any) => {
      const modelName: string = m.model || m.id;
      const ollamaInfo = ollamaInfoByName.get(modelName) ?? ollamaInfoByName.get(modelName.split(':')[0]);
      let description: string;
      if (ollamaInfo) {
        const p: string[] = [];
        p.push(ollamaInfo.isLoaded ? '● loaded' : '○ cold');
        if (ollamaInfo.sizeGB !== undefined) p.push(`${ollamaInfo.sizeGB.toFixed(1)} GB`);
        if (ollamaInfo.supportsTools) p.push('[tools]');
        description = p.join(' · ');
      } else {
        description = m.model || m.baseURL || '';
      }
      return {
        value: m.id,
        label: (m as any).label || m.name || m.model || m.id,
        description,
        isCurrent: m.id === currentModelId,
      };
    });

    // Auto-discovered local Ollama models not yet in config
    const discoveredOptions = [...ollamaInfoByName.values()]
      .filter(info => !configuredIds.has(info.name) && !configuredIds.has(info.name.split(':')[0]))
      .filter((info, idx, arr) => arr.findIndex(x => x.name === info.name) === idx)
      .map(info => {
        const p: string[] = ['○ ollama · not saved'];
        if (info.sizeGB !== undefined) p.push(`${info.sizeGB.toFixed(1)} GB`);
        if (info.supportsTools) p.push('[tools]');
        return {
          value: `__ollama__${info.name}`,
          label: info.name,
          description: p.join(' · '),
          isCurrent: false,
        };
      });

    const allOptions = [...configuredOptions, ...discoveredOptions];

    if (allOptions.length === 0) {
      const modelInfo = defaultModel?.model || currentModelId || 'unknown';
      return { success: true, type: 'info', content: `## model\n\ncurrent: \`${modelInfo}\`\n\nno models configured. use /model add <id> <name> <model> <baseURL> <apiKey>` };
    }

    return {
      success: true,
      type: 'selector',
      selector: {
        title: 'Select model',
        options: allOptions,
        handler: 'model',
      },
    };
  },
};

/**
 * /router - 自动路由：按任务复杂度自动选择模
 */
export const routerCommand: SlashCommand = {
  name: 'router',
  description: 'Auto-pick a model per message based on task complexity',
  category: 'config',
  usage: '/router [on|off|set <simple|medium|complex> <modelId>|stats]',
  examples: ['/router', '/router on', '/router off', '/router set simple deepseek-chat', '/router stats'],
  fullDescription:
    'Classifies each message as simple/medium/complex (cheap heuristics, no extra LLM call) ' +
    'and picks the cheapest configured model that fits, unless /model has been used this session. ' +
    'When no tier is set explicitly, learns from outcomes (a model that keeps getting aborted for a ' +
    'tier loses ground to the next cheapest one over time) — see /router stats for the learned data.',

  async handler(args: string): Promise<SlashCommandResult> {
    const { configActions, appActions, getState } = await import('../store/index.js');
    const state = getState();
    const config = state.config.config;
    const autoRouter = config?.autoRouter || { enabled: false, tiers: {} };
    const models = config?.models || [];

    const persist = async (next: typeof autoRouter) => {
      configActions().updateConfig({ autoRouter: next });
      try {
        const fs = await import('fs');
        const path = await import('path');
        const os = await import('os');
        const cfgPath = path.join(os.homedir(), '.aegiscode', 'config.json');
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        cfg.autoRouter = next;
        fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
      } catch { /* non-fatal */ }
    };

    const parts = args.trim().split(/\s+/).filter(Boolean);
    const subcommand = parts[0]?.toLowerCase();

    if (subcommand === 'on') {
      await persist({ ...autoRouter, enabled: true });
      appActions().setManualModelOverride(false);
      return { success: true, type: 'success', message: 'auto-router: on' };
    }

    if (subcommand === 'off') {
      await persist({ ...autoRouter, enabled: false });
      appActions().setAutoRouterActiveModel(null);
      return { success: true, type: 'success', message: 'auto-router: off' };
    }

    if (subcommand === 'set') {
      const tier = parts[1]?.toLowerCase();
      const modelId = parts[2];
      if (!tier || !['simple', 'medium', 'complex'].includes(tier) || !modelId) {
        return {
          success: false,
          type: 'error',
          content: 'usage: /router set <simple|medium|complex> <modelId>',
        };
      }
      if (!models.find(m => m.id === modelId)) {
        return { success: false, type: 'error', content: `unknown model id: \`${modelId}\` — see /model list` };
      }
      await persist({ ...autoRouter, tiers: { ...autoRouter.tiers, [tier]: modelId } });
      return { success: true, type: 'success', message: `auto-router: ${tier} -> ${modelId}` };
    }

    if (subcommand === 'stats') {
      const { getRouterStats } = await import('../agent/routerStats.js');
      const stats = getRouterStats();
      const tierNames: Array<'simple' | 'medium' | 'complex'> = ['simple', 'medium', 'complex'];
      const lines = ['learned outcomes (success / aborted-or-errored), per tier:'];
      for (const tier of tierNames) {
        const tierStats = stats[tier];
        if (!tierStats || Object.keys(tierStats).length === 0) {
          lines.push(`  ${tier.padEnd(8)} no data yet`);
          continue;
        }
        lines.push(`  ${tier}:`);
        for (const [modelId, s] of Object.entries(tierStats)) {
          const total = s.success + s.failure;
          const rate = total > 0 ? Math.round((s.success / total) * 100) : 0;
          lines.push(`    ${modelId.padEnd(20)} ${s.success}/${total} (${rate}%)`);
        }
      }
      lines.push('', 'Aborting a response counts against the model that was handling it — this is what nudges future picks.');
      return { success: true, type: 'info', content: lines.join('\n') };
    }

    // ── no args — status ──
    const tiers = autoRouter.tiers || {};
    const lines = [
      `auto-router: ${autoRouter.enabled ? 'on' : 'off'}${state.app.manualModelOverride ? ' (backed off — /model set manually this session)' : ''}`,
      `  simple   ${tiers.simple || '(auto)'}`,
      `  medium   ${tiers.medium || '(auto)'}`,
      `  complex  ${tiers.complex || '(auto)'}`,
    ];
    return { success: true, type: 'info', content: lines.join('\n') };
  },
};

/**
 * /effort - extended-thinking budget tier (native Anthropic transport only)
 */
export const effortCommand: SlashCommand = {
  name: 'effort',
  description: 'Set Claude\'s extended-thinking effort level',
  category: 'config',
  usage: '/effort [off|low|medium|high|max]',
  examples: ['/effort', '/effort high', '/effort off'],
  fullDescription:
    'Controls Claude\'s adaptive thinking depth via output_config.effort. Higher levels reason more ' +
    'before answering — better for hard problems, slower and more expensive for simple ones. ' +
    'Only takes effect on the native Anthropic API path (not OpenAI-compatible providers, and not Haiku models).',

  async handler(args: string): Promise<SlashCommandResult> {
    const { configActions, getState } = await import('../store/index.js');
    const state = getState();
    const config = state.config.config;
    const current = config?.thinking?.budget || 'off';

    const persist = async (budget: typeof current) => {
      configActions().updateConfig({ thinking: { budget } });
      try {
        const fs = await import('fs');
        const path = await import('path');
        const os = await import('os');
        const cfgPath = path.join(os.homedir(), '.aegiscode', 'config.json');
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        cfg.thinking = { budget };
        fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
      } catch { /* non-fatal */ }
    };

    const arg = args.trim().toLowerCase();
    if (!arg) {
      return { success: true, type: 'info', content: `thinking effort: ${current}` };
    }

    const valid = ['off', 'low', 'medium', 'high', 'max'];
    if (!valid.includes(arg)) {
      return { success: false, type: 'error', content: `usage: /effort [${valid.join('|')}]` };
    }

    await persist(arg as typeof current);
    return { success: true, type: 'success', message: `thinking effort: ${arg}` };
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

// ─── /tokens helpers ────────────────────────────────────────────────

function tokFmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function tokBar(ratio: number, width: number): string {
  const filled = Math.max(0, Math.min(width, Math.round(ratio * width)));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function tokCost(model: string, inputTok: number, outputTok: number): number | null {
  const m = model.toLowerCase();
  // per-MTok prices
  let ip: number, op: number;
  if      (m.includes('opus-4'))    { ip = 15;   op = 75;  }
  else if (m.includes('sonnet-4'))  { ip = 3;    op = 15;  }
  else if (m.includes('haiku-4'))   { ip = 0.8;  op = 4;   }
  else if (m.includes('claude'))    { ip = 3;    op = 15;  }
  else if (m.includes('gpt-4o'))    { ip = 2.5;  op = 10;  }
  else if (m.includes('gpt-4'))     { ip = 30;   op = 60;  }
  else if (m.includes('gpt-3.5'))   { ip = 0.5;  op = 1.5; }
  else return null;
  return (inputTok * ip + outputTok * op) / 1_000_000;
}

function tokShortModel(model: string): string {
  const m = model.toLowerCase();
  if (m.includes('claude-sonnet-4-6')) return 'claude-sonnet-4.6';
  if (m.includes('claude-sonnet-4'))   return 'claude-sonnet-4';
  if (m.includes('claude-opus-4'))     return 'claude-opus-4';
  if (m.includes('claude-haiku-4'))    return 'claude-haiku-4';
  return model.length > 24 ? model.slice(0, 21) + '...' : model;
}

/**
 * /tokens - token usage graph and estimated cost
 */
export const tokensCommand: SlashCommand = {
  name: 'tokens',
  aliases: ['tok'],
  description: 'Show token usage graph and estimated spend',
  category: 'session',
  usage: '/tokens',
  fullDescription: 'Visualises token consumption for this session as an ASCII bar chart, including input/output split, context-window usage, estimated USD cost, and a per-turn breakdown.',

  async handler(_args: string, context: SlashCommandContext): Promise<SlashCommandResult> {
    const state = getState();
    const { session, config } = state;
    const usage    = session.tokenUsage;
    const messages = session.messages.filter(m => !m.isStreaming);
    const runtimeConfig = config.config;
    const maxCtx   = (runtimeConfig as any)?.maxContextTokens ?? 200_000;
    const model    = context.modelName || runtimeConfig?.currentModelId || 'claude-sonnet-4-6';

    const totalIn  = usage.inputTokens  || 0;
    const totalOut = usage.outputTokens || 0;
    const total    = totalIn + totalOut;
    const BAR      = 28;
    const DIVIDER  = `${'─'.repeat(BAR + 12)}`;

    // shared price lookup
    const priceFor = (mdl: string): [number, number] => {
      const m = mdl.toLowerCase();
      if      (m.includes('opus-4'))    return [15,    75   ];
      else if (m.includes('sonnet-4'))  return [3,     15   ];
      else if (m.includes('haiku-4'))   return [0.8,   4    ];
      else if (m.includes('fable-5'))   return [5,     25   ];
      else if (m.includes('claude'))    return [3,     15   ];
      else if (m.includes('gpt-4o'))    return [2.5,   10   ];
      else if (m.includes('gpt-4'))     return [30,    60   ];
      else if (m.includes('gpt-3.5'))   return [0.5,   1.5  ];
      else if (m.includes('deepseek'))  return [0.14,  0.28 ];
      else if (m.includes('llama') || m.includes('groq')) return [0.06, 0.06];
      else if (m.includes('gemini-2.5-pro'))  return [1.25, 10  ];
      else if (m.includes('gemini-2.5-flash')) return [0.15, 0.6 ];
      else                              return [1,     3    ];
    };

    const fmtCost = (v: number) =>
      v === 0     ? '$0.0000'          :
      v < 0.00001 ? '<$0.00001'        :
      v < 0.01    ? `$${v.toFixed(5)}` :
                    `$${v.toFixed(4)}`;

    // ── context meter ──
    const ctxTokens = context.contextManager?.getTokenCount?.() ?? 0;
    const ctxRatio  = maxCtx > 0 ? Math.min(1, ctxTokens / maxCtx) : 0;

    // ── per-turn data ──
    const turns = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map((m, i) => ({
        n:    i + 1,
        role: m.role as 'user' | 'assistant',
        est:  Math.max(1, Math.ceil((m.content?.length ?? 0) / 4)),
        ts:   m.timestamp,
      }));

    // ── session cost ──
    const [ip, op] = priceFor(model);
    const sessionCost = (totalIn * ip + totalOut * op) / 1_000_000;

    // ── build output ──
    const L: string[] = [];
    L.push('## ◆ token usage');
    L.push('');

    if (ctxTokens > 0) {
      const pct = `${Math.round(ctxRatio * 100)}%`;
      L.push(`context  ${tokBar(ctxRatio, BAR)}  ${pct} · ${tokFmt(ctxTokens)} / ${tokFmt(maxCtx)}`);
      L.push('');
    }

    const maxIO = Math.max(totalIn, totalOut, 1);
    L.push(`in       ${tokBar(totalIn  / maxIO, BAR)}  ${tokFmt(totalIn)}`);
    L.push(`out      ${tokBar(totalOut / maxIO, BAR)}  ${tokFmt(totalOut)}`);
    L.push(`         ${'─'.repeat(BAR + 2)}`);
    L.push(`total    ${' '.repeat(BAR)}  ${tokFmt(total)}`);
    if (sessionCost > 0) {
      L.push(`cost     ${' '.repeat(BAR)}  ~${fmtCost(sessionCost)}  ·  ${tokShortModel(model)}`);
    }

    // ─────────────────────────────────────────────────────────────
    // $ cost over turns — line graph (needs ≥ 4 turns)
    // ─────────────────────────────────────────────────────────────
    if (turns.length >= 4) {
      const shown   = turns.slice(-30);
      const skipped = turns.length - shown.length;

      let cum = 0;
      const cumCosts = shown.map(t => {
        cum += (t.est * (t.role === 'user' ? ip : op)) / 1_000_000;
        return cum;
      });
      const maxCum = cumCosts[cumCosts.length - 1] || 0.000001;

      const W = 54, H = 10, YW = 9;

      const colFor = (i: number) =>
        shown.length < 2 ? 0 : Math.round(i * (W - 1) / (shown.length - 1));
      const rowFor = (c: number) =>
        H - 1 - Math.round((c / maxCum) * (H - 1));

      const grid: string[][] = Array.from({length: H}, () => Array(W).fill(' '));

      for (let i = 0; i < shown.length - 1; i++) {
        let x0 = colFor(i),     y0 = rowFor(cumCosts[i]);
        const x1 = colFor(i+1), y1 = rowFor(cumCosts[i+1]);
        const dx =  Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        while (true) {
          if (grid[y0][x0] === ' ') grid[y0][x0] = '·';
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      }
      for (let i = 0; i < shown.length; i++) grid[rowFor(cumCosts[i])][colFor(i)] = '◆';

      L.push(''); L.push(DIVIDER); L.push('');
      L.push('$ cost over turns  (cumulative)');
      L.push('');
      if (skipped > 0) L.push(`  ··· ${skipped} earlier turns not shown`);

      // 3 y-ticks: top, mid, bottom — │ on all other rows
      const yTicks = new Map([[0, maxCum], [Math.round((H-1)/2), maxCum/2], [H-1, 0]]);
      for (let r = 0; r < H; r++) {
        const yLabel = yTicks.has(r)
          ? fmtCost(yTicks.get(r)!).padStart(YW)
          : ' '.repeat(YW);
        const ax = yTicks.has(r) ? (r === H-1 ? '┴' : '┤') : '│';
        L.push(`  ${yLabel} ${ax}${grid[r].join('')}`);
      }
      L.push(`  ${' '.repeat(YW)} └${'─'.repeat(W + 1)}`);

      // x-axis: turn numbers every ~6 turns, min 4 chars apart
      const xChars = Array(W).fill(' ');
      const xStep  = Math.max(2, Math.round(shown.length / 6));
      for (let i = 0; i < shown.length; i += xStep) {
        const pos = colFor(i);
        const num = String(shown[i].n);
        if (pos + num.length < W) {
          for (let j = 0; j < num.length; j++) xChars[pos + j] = num[j];
        }
      }
      L.push(`  ${' '.repeat(YW + 2)}${xChars.join('')}  turn`);
    }

    // ─────────────────────────────────────────────────────────────
    // stacked bar chart — models with ≥ 5 % of total tokens, max 3
    // ─────────────────────────────────────────────────────────────
    const breakdown = usage.modelBreakdown ?? {};
    const allModels = Object.keys(breakdown);
    if (allModels.length >= 2) {
      const totalTok = allModels.reduce(
        (s, m) => s + breakdown[m].inputTokens + breakdown[m].outputTokens, 0
      );

      const modelCosts = allModels
        .filter(mdl => (breakdown[mdl].inputTokens + breakdown[mdl].outputTokens) / Math.max(totalTok, 1) >= 0.05)
        .map(mdl => {
          const { inputTokens: iT, outputTokens: oT } = breakdown[mdl];
          const [mip, mop] = priceFor(mdl);
          const inCost  = (iT  * mip) / 1_000_000;
          const outCost = (oT  * mop) / 1_000_000;
          return { mdl, inCost, outCost, total: inCost + outCost };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 3);

      if (modelCosts.length >= 2) {
        const maxBar  = Math.max(...modelCosts.map(m => m.total), 0.000001);
        const BAR_H   = 8, BAR_W = 12, GAP = 4, LBL_W = 9;
        const CHART_W = modelCosts.length * (BAR_W + GAP) - GAP;

        L.push(''); L.push(DIVIDER); L.push('');
        L.push('$ by model  (session, ≥ 5 % usage)');
        L.push('');

        const yTicks3 = new Map([
          [BAR_H,               maxBar],
          [Math.ceil(BAR_H / 2), maxBar / 2],
          [1,                   0],
        ]);

        for (let row = BAR_H; row >= 1; row--) {
          let line = '';
          for (let mi = 0; mi < modelCosts.length; mi++) {
            if (mi > 0) line += ' '.repeat(GAP);
            const { inCost, outCost } = modelCosts[mi];
            const inRows  = Math.round((inCost  / maxBar) * BAR_H);
            const totRows = Math.min(Math.round(((inCost + outCost) / maxBar) * BAR_H), BAR_H);
            if      (row <= inRows)  line += '▓'.repeat(BAR_W);
            else if (row <= totRows) line += '░'.repeat(BAR_W);
            else                     line += ' '.repeat(BAR_W);
          }
          const yLabel = yTicks3.has(row)
            ? fmtCost(yTicks3.get(row)!).padStart(LBL_W)
            : ' '.repeat(LBL_W);
          const ax = yTicks3.has(row) ? (row === 1 ? '┴' : '┤') : '│';
          L.push(`  ${yLabel} ${ax} ${line}`);
        }
        L.push(`  ${' '.repeat(LBL_W)} └${'─'.repeat(CHART_W + 2)}`);

        // centered model labels + cost
        for (let mi = 0; mi < modelCosts.length; mi++) {
          if (mi === 0) process.stdout.write(''); // no-op to set up spacing
        }
        let nameRow = '  ' + ' '.repeat(LBL_W + 2);
        let costRow = '  ' + ' '.repeat(LBL_W + 2);
        for (let mi = 0; mi < modelCosts.length; mi++) {
          if (mi > 0) { nameRow += ' '.repeat(GAP); costRow += ' '.repeat(GAP); }
          const short = modelCosts[mi].mdl
            .replace(/claude-/, '').replace(/openai-/, '').replace(/-\d{8,}$/, '')
            .slice(0, BAR_W);
          nameRow += short.padEnd(BAR_W);
          costRow += fmtCost(modelCosts[mi].total).padEnd(BAR_W).slice(0, BAR_W);
        }
        L.push(nameRow);
        L.push(costRow);
        L.push('');
        L.push(`  ${' '.repeat(LBL_W + 2)}▓ input  ░ output`);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // performance — response time + benchmark vs claude-sonnet-4.6
    // ─────────────────────────────────────────────────────────────
    if (turns.length >= 2) {
      // pair user → assistant to get response durations
      const responseTimes: number[] = [];
      const outEstimates: number[] = [];
      for (let i = 1; i < turns.length; i++) {
        if (turns[i].role === 'assistant' && turns[i-1].role === 'user') {
          const dt = turns[i].ts - turns[i-1].ts;
          if (dt > 0 && dt < 300_000) {   // sanity: 0–5 min
            responseTimes.push(dt);
            outEstimates.push(turns[i].est);
          }
        }
      }

      const avgMs  = responseTimes.length
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;
      const avgTokPerSec = avgMs > 0 && outEstimates.length
        ? outEstimates.reduce((a, b) => a + b, 0) / outEstimates.length / (avgMs / 1000)
        : 0;
      const turnCount   = Math.floor(turns.length / 2);
      const costPerTurn = turnCount > 0 ? sessionCost / turnCount : 0;

      // benchmark: claude-sonnet-4.6
      const [bip, bop] = priceFor('claude-sonnet-4-6');
      const benchCost  = (totalIn * bip + totalOut * bop) / 1_000_000;
      const ratio      = benchCost > 0 ? sessionCost / benchCost : 1;
      const ratioStr   = ratio <= 1
        ? `${(ratio).toFixed(2)}×  (${Math.round((1 - ratio) * 100)}% cheaper)`
        : `${(ratio).toFixed(2)}×  (${Math.round((ratio - 1) * 100)}% more expensive)`;

      const COL1 = 18, COL2 = 16, COL3 = 20;
      const row = (label: string, cur: string, bench?: string) =>
        `  ${label.padEnd(COL1)}${cur.padEnd(COL2)}${bench ?? ''}`;

      L.push(''); L.push(DIVIDER); L.push('');
      L.push('performance');
      L.push('');
      L.push(row('', 'this session', 'vs sonnet-4.6'));
      L.push(`  ${'─'.repeat(COL1 + COL2 + COL3)}`);
      if (avgMs > 0) {
        const secStr  = `${(avgMs / 1000).toFixed(1)}s avg`;
        L.push(row('response time', secStr));
      }
      if (avgTokPerSec > 0) {
        L.push(row('est. tok/sec', `~${Math.round(avgTokPerSec)} t/s`));
      }
      L.push(row('turns', `${turnCount}`));
      L.push(row('cost/turn', `~${fmtCost(costPerTurn)}`));
      L.push(row('session total', `~${fmtCost(sessionCost)}`, `~${fmtCost(benchCost)}`));
      L.push(row('vs benchmark', ratioStr));
    }

    // Stream into the existing streaming message so everything lands in one
    // render pass — avoids the empty-streaming-msg + batch-content split that
    // required two Enter presses to see the full output.
    if (context.onContentDelta) {
      context.onContentDelta(L.join('\n'));
      return { success: true, type: 'silent' };
    }
    return { success: true, type: 'info', content: L.join('\n') };
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
        return {
          success: true,
          type: 'success',
          message: `Copied ${lines} lines from assistant reply`,
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

    // Build confirmation — Claude Code style
    const lines = target.content.split('\n').length;
    const label = target.filePath || target.language || 'code';
    const hint = codeBlocks.length > 1 ? ` · ${codeBlocks.length} blocks total` : '';

    return {
      success: true,
      type: 'success',
      message: `Copied ${lines} lines from ${label}${hint}`,
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


/**
 * Detect task type from the task string.
 * Returns 'scaffold', 'refactor', 'review', or 'default'.
 */
function detectTaskType(task: string): 'scaffold' | 'refactor' | 'review' | 'default' {
  const lower = task.toLowerCase();
  if (/^(build|create|new|scaffold|generate|make|init|bootstrap)\b/.test(lower)) return 'scaffold';
  if (/^(refactor|restructure|reorganize|redesign|rewrite)\b/.test(lower)) return 'refactor';
  if (/^(review|audit|inspect|check|analyze|security|vulnerab)\b/.test(lower)) return 'review';
  return 'default';
}

/**
 * Build agent configs dynamically based on task type.
 * Scaffold mode agents get full Write/Edit/Bash access for building new apps.
 * Each mode ends with a synthesizer agent for result fusion.
 */
function buildMultiAgents(type: 'scaffold' | 'refactor' | 'review' | 'default', config: AgentConfig): SubAgentConfig[] {
  const agentConfig = { ...config, timeout: 180000 };

  // Shared synthesizer used by all modes
  const synthesizer: SubAgentConfig = {
    name: 'synthesizer',
    role: 'Technical Lead',
    systemPrompt: `You are a senior technical lead. Given analysis from multiple specialist agents, synthesize their findings into a clear, actionable summary.
Structure your response as: key findings, recommended approach, top action items.
Be direct, concrete, and avoid repeating everything the agents said.
Focus on delivering a decision-ready synthesis.`,
    config: agentConfig,
  };

  switch (type) {
    case 'scaffold':
      return [
        {
          name: 'architect',
          role: 'System Architect',
          systemPrompt: `You are a System Architect. Design the new application architecture.
Define: project structure, tech stack, directory layout, key modules, data flow, API design.
Consider: scalability, maintainability, testing strategy, deployment.
Output a concrete file tree and architecture decisions log. Be specific.`,
          config: agentConfig,
          tools: ['Read', 'Grep', 'Glob'],
        },
        {
          name: 'scaffolder',
          role: 'Project Scaffolder',
          systemPrompt: `You are a Project Scaffolder. Build the complete application from scratch.

YOUR JOB IS TO CREATE ALL PROJECT FILES - not just describe them.

Use Write to create: package.json, tsconfig.json, source files, configs, tests.
Generate COMPLETE, WORKING code - not stubs or placeholders.
Set up build scripts, lint config, and any necessary tooling.

After creating files, use Bash to run: npm/pnpm install, then build/compile.
Fix any errors until the project builds successfully.

Be thorough - a real, runnable project is the goal.`,
          config: agentConfig,
          tools: ['Read', 'Write', 'Edit', 'Grep', 'Glob', 'Bash'],
        },
        {
          name: 'reviewer',
          role: 'Code Reviewer',
          systemPrompt: `You are a Code Reviewer. Review the scaffolded project.
Check for: missing types, broken imports, misconfigured package.json, error handling gaps.
Report issues with specific file paths and fix suggestions. Be concise.`,
          config: agentConfig,
          tools: ['Read', 'Grep', 'Glob'],
        },
        synthesizer,
      ];

    case 'refactor':
      return [
        {
          name: 'analyzer',
          role: 'Code Analyzer',
          systemPrompt: `You are a Code Analyzer. Find refactoring opportunities.
Look for: duplicated code, long functions (>20 lines), complex conditionals, unused imports,
circular dependencies, inconsistent patterns. Report with file paths and line numbers.`,
          config: agentConfig,
          tools: ['Read', 'Grep', 'Glob'],
        },
        {
          name: 'planner',
          role: 'Refactoring Planner',
          systemPrompt: `You are a Refactoring Planner. Given the analyzer findings, create a step-by-step plan.
Each step: file path, what to change, why, risk level (LOW/MEDIUM/HIGH).
Include before/after snippets. Order by impact. Be concrete.`,
          config: agentConfig,
          tools: ['Read'],
        },
        {
          name: 'implementer',
          role: 'Implementation Engineer',
          systemPrompt: `You are an Implementation Engineer. Execute the refactoring plan.
Use Edit and Write to make actual code changes.
After each change, use Read to verify correctness. Keep existing code style.
Run build commands to ensure nothing is broken.`,
          config: agentConfig,
          tools: ['Read', 'Edit', 'Write', 'Grep', 'Glob', 'Bash'],
        },
        synthesizer,
      ];

    case 'review':
      return [
        {
          name: 'scanner',
          role: 'Vulnerability Scanner',
          systemPrompt: `You are a Security Vulnerability Scanner.
Scan for: hardcoded API keys/secrets, SQL injection, XSS, unsafe eval/exec, path traversal.
Use Grep with targeted patterns. Report every finding with: file path, severity (CRITICAL/HIGH/MEDIUM/LOW), line number.`,
          config: agentConfig,
          tools: ['Read', 'Grep', 'Glob'],
        },
        {
          name: 'reviewer',
          role: 'Code Reviewer',
          systemPrompt: `You are a Code Reviewer. Review for bugs, logic errors, and quality issues.
Check: type safety, error handling, null safety, race conditions, performance patterns.
Be critical but constructive. Prioritize correctness over style.`,
          config: agentConfig,
          tools: ['Read', 'Grep', 'Glob'],
        },
        {
          name: 'debugger',
          role: 'Debugging Specialist',
          systemPrompt: `You are a Debugging Specialist. Analyze potential runtime issues.
Identify: error handling gaps, edge cases, resource leaks, async issues, testing blind spots.
Suggest testing strategies for each risk area.`,
          config: agentConfig,
          tools: ['Read', 'Grep', 'Glob', 'Bash'],
        },
        synthesizer,
      ];

    default:
      return [
        {
          name: 'architect',
          role: 'System Architect',
          systemPrompt: `You are a System Architect. Analyze the task from an architectural perspective.
Evaluate: code structure, dependencies, design patterns, refactoring opportunities.
Provide specific file paths and recommendations. Be concise and actionable.`,
          config: agentConfig,
          tools: ['Read', 'Grep', 'Glob'],
        },
        {
          name: 'implementer',
          role: 'Implementation Engineer',
          systemPrompt: `You are an Implementation Engineer. Write clean, production-ready code.
Follow existing patterns. Provide complete code blocks with file paths.
Focus on: correctness, error handling, TypeScript types, edge cases.
Use Write/Edit to create or modify files as needed.`,
          config: agentConfig,
          tools: ['Read', 'Edit', 'Write', 'Grep', 'Glob', 'Bash'],
        },
        {
          name: 'reviewer',
          role: 'Code Reviewer',
          systemPrompt: `You are a Code Reviewer. Review the approach and code.
Check: logic errors, type safety, error handling, performance, security.
Be critical but constructive. Report specific issues with file paths.`,
          config: agentConfig,
          tools: ['Read', 'Grep', 'Glob'],
        },
        {
          name: 'debugger',
          role: 'Debugging Specialist',
          systemPrompt: `You are a Debugging Specialist. Analyze potential issues and edge cases.
Identify: failure modes, error handling gaps, testing considerations.
Think about what could go wrong and how to prevent it.`,
          config: agentConfig,
          tools: ['Read', 'Grep', 'Glob', 'Bash'],
        },
        synthesizer,
      ];
  }
}

/**
 * Get a label+icon for the mode.
 */
function modeMeta(type: string): { icon: string; label: string } {
  switch (type) {
    case 'scaffold': return { icon: '🏗', label: 'App Scaffolding' };
    case 'refactor': return { icon: '🔧', label: 'Code Refactoring' };
    case 'review':   return { icon: '🔍', label: 'Code Review' };
    default:         return { icon: '⬡', label: 'Multi-Agent Orchestration' };
  }
}

const multiCommand: SlashCommand = {
  name: 'multi',
  description: 'Orchestrate multiple AI agents on a complex task — /multi <task>',
  category: 'general',
  usage: '/multi <task> [--save-as <name>] [--template <id>]',
  examples: [
    '/multi Refactor the auth module to use JWT',
    '/multi Review the codebase for security issues',
    '/multi Create a new CLI tool for managing TODO lists --save-as todo-app',
    '/multi Build a REST API server for a blog --template refactor',
  ],
  fullDescription: `Orchestrates multiple AI agents in parallel on a complex task, then synthesizes results.

Task types are auto-detected:
  build/create/new/scaffold -> scaffolding agents with full tool access (Write, Edit, Bash)
  refactor                 -> code analysis + planning + implementation agents
  review/audit             -> security/code review agents
  default                  -> architect + implementer + reviewer + debugger

Flags:
  --save-as <name>    Save this agent configuration as a reusable app (e.g. /myapp <task>)
  --template <id>     Start from a template (audit, refactor, test-gen)`,

  async handler(args: string, context: SlashCommandContext): Promise<SlashCommandResult> {
    const trimmed = args?.trim();
    if (!trimmed) return { success: false, type: 'error', error: 'Usage: /multi <task>' };

    let modelConfig;
    try { modelConfig = requireModelConfig(); }
    catch (e) { return { success: false, type: 'error', error: (e as Error).message }; }

    // Parse flags
    const saveAsMatch = trimmed.match(/--save-as\s+(\S+)/);
    const templateMatch = trimmed.match(/--template\s+(\S+)/);
    const saveAs = saveAsMatch ? saveAsMatch[1] : null;
    const templateId = templateMatch ? templateMatch[1] : null;

    // Extract clean task (remove flags)
    const task = trimmed
      .replace(/--save-as\s+\S+/g, '')
      .replace(/--template\s+\S+/g, '')
      .trim();

    if (!task) return { success: false, type: 'error', error: 'Usage: /multi <task>' };

    try {
      const agentConfig: AgentConfig = {
        apiKey: modelConfig.apiKey,
        baseURL: modelConfig.baseURL,
        model: modelConfig.model,
        timeout: 180000,
      };

      let agents: SubAgentConfig[];
      let modeType: string;
      let orchestratorName: string;
      let synthesizerName: string;

      if (templateId) {
        // Use a built-in template
        const templateApp = getApp(templateId);
        if (!templateApp) {
          const available = getRegisteredApps().map(a => a.id).join(', ');
          return { success: false, type: 'error', error: `Template "${templateId}" not found. Available: ${available}` };
        }
        agents = templateApp.agents.map(a => ({
          ...a,
          config: { ...agentConfig, ...a.config },
        }));
        modeType = templateId;
        orchestratorName = templateApp.name;
        synthesizerName = templateApp.synthesizer || agents[agents.length - 1]?.name;
      } else {
        // Detect task type
        modeType = detectTaskType(task);
        orchestratorName = modeMeta(modeType).label;
        agents = buildMultiAgents(modeType as 'scaffold' | 'refactor' | 'review' | 'default', agentConfig);
        synthesizerName = agents[agents.length - 1]?.name;
      }

      // Ask for a single upfront confirmation before any agents run
      if (context.confirmationHandler) {
        const agentNames = agents.filter(a => a.name !== 'synthesizer').map(a => a.name);
        const response = await context.confirmationHandler.requestConfirmation({
          title: `Start multi-agent task?`,
          message: task,
          details: `Agents: ${agentNames.join(', ')}`,
        });
        if (!response.approved) {
          return { success: false, type: 'info', content: 'Multi-agent task cancelled.' };
        }
      }

      // Build orchestrator
      const orchestrator = new OrchestratorAgent(
        `Multi-${modeType}`,
        `You are ${orchestratorName}. Coordinate specialist agents to achieve the task.`,
      );

      // Serialize confirmations so parallel agents don't race on the single dialog slot
      let confirmQueue: Promise<any> = Promise.resolve();
      const serialHandler = context.confirmationHandler
        ? { requestConfirmation: (details: any) => { confirmQueue = confirmQueue.then(() => context.confirmationHandler!.requestConfirmation(details)); return confirmQueue; } }
        : undefined;

      for (const agent of agents) {
        orchestrator.registerAgent({
          ...agent,
          confirmationHandler: serialHandler,
        });
      }

      // Build workspace source context so agents know what files exist
      const cwd = context.cwd || process.cwd();
      const sourceCtx = buildSourceContext(cwd);
      const codeContext = sourceCtx
        ? `\n\nWorkspace context (project metadata + file tree + structure summaries + git changes):\n${sourceCtx}\n\nUse Read / Grep / Glob to examine these — structure summaries show exports/classes in each file.`
        : '\n\nUse Read / Grep / Glob to explore the codebase before responding.';

      // Build sub-tasks — each agent gets a focused assignment matching their role
      const subTasks: Record<string, string> = {};

      // Mapping of agent names to focused sub-task descriptions
      const subTaskMap: Record<string, string> = {
        architect:  `Focus on architecture and design. Evaluate the project structure, dependencies, data flow, and design patterns. Propose a concrete plan with specific file paths.${codeContext}`,
        scaffolder: `Focus on implementation. Build the complete project — create all files with working code, set up configs, install dependencies, and verify the build succeeds.${codeContext}`,
        reviewer:   `Focus on code review. Examine the code for bugs, type safety, error handling gaps, and consistency issues. Report specific problems with file paths and fix suggestions.${codeContext}`,
        debugger:   `Focus on runtime analysis. Identify potential failure modes, edge cases, resource leaks, and async issues. Think about what could go wrong and how to prevent it.${codeContext}`,
        scanner:    `Focus on security. Scan for hardcoded secrets, injection flaws, XSS, unsafe eval/exec, and path traversal. Report severity and exact locations.${codeContext}`,
        analyzer:   `Focus on code analysis. Find duplicated code, long functions, complex conditionals, unused imports, circular dependencies, and inconsistent patterns. Report with file paths.${codeContext}`,
        planner:    `Focus on planning. Given the analysis findings, create a step-by-step refactoring plan with file paths, change descriptions, risk levels, and before/after snippets.${codeContext}`,
        implementer:`Focus on implementation. Write clean, production-ready code. Make actual file changes using Write/Edit. Verify correctness and run builds to ensure nothing is broken.${codeContext}`,
        synthesizer:`Focus on synthesis. You will receive all agent responses and produce a final summary. (Synthesis task is handled separately.)`,
      };

      // Exclude the synthesizer from parallel sub-tasks — it only runs during synthesis phase
      for (const agent of agents) {
        if (agent.name === 'synthesizer') continue;
        subTasks[agent.name] = subTaskMap[agent.name] || `Analyze the task from a ${agent.role} perspective and provide recommendations.${codeContext}`;
      }

      // Stream progress in real-time if context supports it
      if (context.onContentDelta) {
        const { icon, label } = modeMeta(modeType);
        context.onContentDelta(`## ${icon} ${label}\n`);
        context.onContentDelta(`**Task:** ${task}\n\n`);
        context.onContentDelta(`*Agents: ${agents.filter(a => a.name !== 'synthesizer').map(a => a.name).join(', ')}*\n\n`);
        context.onContentDelta(`*Tool calls will require confirmation*\n\n---\n\n`);
      }

      // Run
      const result = await orchestrator.orchestrate(task, subTasks, synthesizerName, context.sessionId);

      // If --save-as, register as reusable AppBuilder app
      if (saveAs) {
        const saveId = saveAs.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();

        // Check for conflicts
        if (getApp(saveId)) {
          return {
            success: false,
            type: 'error',
            error: `App "${saveId}" already exists. Choose a different name.`,
          };
        }

        const builder = new AppBuilder(saveId, `${task.slice(0, 50)}...`)
          .describe(`Custom app created via /multi: ${task.slice(0, 120)}`)
          .use(`/${saveId} <task>`)
          .examples([`/${saveId} ${task.slice(0, 60)}`]);

        for (const agent of agents) {
          builder.agent(agent.name, agent.role, agent.systemPrompt, agent.tools);
        }

        builder.register();
      }

      // Format output — stream each agent result if possible
      const { icon, label } = modeMeta(modeType);
      const lines: string[] = [];

      if (!context.onContentDelta) {
        // Non-streaming: build full text as before
        lines.push(`## ${icon} ${label}`);
        lines.push(`**Task:** ${task}`);
        lines.push('');
      }

      for (const response of result.responses) {
        const agentCfg = agents.find(a => a.name === response.agentName);
        const role = agentCfg?.role || response.agentName;
        const toolHint = response.metadata?.toolCallsCount
          ? ` [${response.metadata.toolCallsCount} tool calls]`
          : '';
        const header = `### ${role}${toolHint}`;
        const duration = response.metadata?.durationMs
          ? `*${(response.metadata.durationMs / 1000).toFixed(1)}s*`
          : '';

        if (context.onContentDelta) {
          context.onContentDelta(`\n${header}\n`);
          if (duration) context.onContentDelta(`${duration}\n\n`);
          context.onContentDelta(`${response.content || '*No response*'}\n\n`);
        } else {
          lines.push(header);
          if (duration) lines.push(duration);
          lines.push('');
          lines.push(response.content || '*No response*');
          lines.push('');
        }
      }

      if (!context.onContentDelta) {
        lines.push('---');
        lines.push('### Synthesized Summary');
        lines.push('');
        lines.push(result.summary);
        lines.push('');
      } else {
        context.onContentDelta(`---\n\n### Synthesized Summary\n\n${result.summary}\n\n`);
      }

      const statusParts = [
        `${result.metadata.agentsUsed} agents`,
        `${(result.metadata.totalDurationMs / 1000).toFixed(1)}s`,
      ];
      if (result.metadata.totalTokens) {
        statusParts.push(`${result.metadata.totalTokens} tokens`);
      }
      if (saveAs) {
        const saveId = saveAs.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
        statusParts.push(`saved as /${saveId}`);
      }
      const statusLine = `*${statusParts.join(' \u00b7 ')}*`;

      if (context.onContentDelta) {
        context.onContentDelta(`\n${statusLine}\n`);
        context.onContentDelta(`\n✅ **Multi-agent task complete!**\n`);
      } else {
        lines.push(statusLine);
        lines.push('');
        lines.push('✅ Multi-agent task complete!');
        return { success: true, type: 'info', content: lines.join('\n') };
      }

      return { success: true, type: 'silent' };
    } catch (error) {
      return {
        success: false,
        type: 'error',
        error: `/multi failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * /multiyolo — same as /multi but with YOLO mode (auto-approve all tool calls)
 */
const multiYoloCommand: SlashCommand = {
  name: 'multiyolo',
  description: 'Multi-agent orchestration with YOLO mode — /multiyolo <task>',
  category: 'general',
  usage: '/multiyolo <task>',
  examples: ['/multiyolo Refactor the auth module to use JWT', '/multiyolo Create a new CLI tool'],
  fullDescription: `Same as /multi but with YOLO mode enabled — all tool calls are auto-approved.
Use with caution as this allows agents to write files and run commands without confirmation.`,

  async handler(args: string, context: SlashCommandContext): Promise<SlashCommandResult> {
    const trimmed = args?.trim();
    if (!trimmed) return { success: false, type: 'error', error: 'Usage: /multiyolo <task>' };

    let modelConfig;
    try { modelConfig = requireModelConfig(); }
    catch (e) { return { success: false, type: 'error', error: (e as Error).message }; }

    // Parse flags
    const saveAsMatch = trimmed.match(/--save-as\s+(\S+)/);
    const templateMatch = trimmed.match(/--template\s+(\S+)/);
    const saveAs = saveAsMatch ? saveAsMatch[1] : null;
    const templateId = templateMatch ? templateMatch[1] : null;

    // Extract clean task (remove flags)
    const task = trimmed
      .replace(/--save-as\s+\S+/g, '')
      .replace(/--template\s+\S+/g, '')
      .trim();

    if (!task) return { success: false, type: 'error', error: 'Usage: /multiyolo <task>' };

    try {
      const agentConfig: AgentConfig = {
        apiKey: modelConfig.apiKey,
        baseURL: modelConfig.baseURL,
        model: modelConfig.model,
        timeout: 180000,
      };

      let agents: SubAgentConfig[];
      let modeType: string;
      let orchestratorName: string;
      let synthesizerName: string;

      if (templateId) {
        const templateApp = getApp(templateId);
        if (!templateApp) {
          const available = getRegisteredApps().map(a => a.id).join(', ');
          return { success: false, type: 'error', error: `Template "${templateId}" not found. Available: ${available}` };
        }
        agents = templateApp.agents.map(a => ({
          ...a,
          config: { ...agentConfig, ...a.config },
        }));
        modeType = templateId;
        orchestratorName = templateApp.name;
        synthesizerName = templateApp.synthesizer || agents[agents.length - 1]?.name;
      } else {
        modeType = detectTaskType(task);
        orchestratorName = modeMeta(modeType).label;
        agents = buildMultiAgents(modeType as 'scaffold' | 'refactor' | 'review' | 'default', agentConfig);
        synthesizerName = agents[agents.length - 1]?.name;
      }

      const orchestrator = new OrchestratorAgent(
        `Multi-YOLO-${modeType}`,
        `You are ${orchestratorName}. Coordinate specialist agents to achieve the task. (YOLO mode)`,
      );

      // Attach with YOLO permission mode — all tool calls auto-approved
      for (const agent of agents) {
        orchestrator.registerAgent({
          ...agent,
          confirmationHandler: context.confirmationHandler,
          permissionMode: 'yolo' as any,
        });
      }

      // Build sub-tasks
      const subTasks: Record<string, string> = {};
      const subTaskMap: Record<string, string> = {
        architect:  `Focus on architecture and design. Evaluate the project structure, dependencies, data flow, and design patterns. Propose a concrete plan with specific file paths.`,
        scaffolder: `Focus on implementation. Build the complete project — create all files with working code, set up configs, install dependencies, and verify the build succeeds.`,
        reviewer:   `Focus on code review. Examine the code for bugs, type safety, error handling gaps, and consistency issues. Report specific problems with file paths and fix suggestions.`,
        debugger:   `Focus on runtime analysis. Identify potential failure modes, edge cases, resource leaks, and async issues. Think about what could go wrong and how to prevent it.`,
        scanner:    `Focus on security. Scan for hardcoded secrets, injection flaws, XSS, unsafe eval/exec, and path traversal. Report severity and exact locations.`,
        analyzer:   `Focus on code analysis. Find duplicated code, long functions, complex conditionals, unused imports, circular dependencies, and inconsistent patterns. Report with file paths.`,
        planner:    `Focus on planning. Given the analysis findings, create a step-by-step refactoring plan with file paths, change descriptions, risk levels, and before/after snippets.`,
        implementer:`Focus on implementation. Write clean, production-ready code. Make actual file changes using Write/Edit. Verify correctness and run builds to ensure nothing is broken.`,
        synthesizer:`Focus on synthesis. You will receive all agent responses and produce a final summary. (Synthesis task is handled separately.)`,
      };

      for (const agent of agents) {
        if (agent.name === 'synthesizer') continue;
        subTasks[agent.name] = subTaskMap[agent.name] || `Analyze the task from a ${agent.role} perspective and provide recommendations.`;
      }

      // Stream progress
      if (context.onContentDelta) {
        context.onContentDelta(`## ⚡ Multi-Agent Orchestration (YOLO)\n`);
        context.onContentDelta(`**Task:** ${task}\n\n`);
        context.onContentDelta(`*Agents: ${agents.filter(a => a.name !== 'synthesizer').map(a => a.name).join(', ')}*\n\n`);
        context.onContentDelta(`*Permission mode: \`yolo\` — all tool calls auto-approved*\n\n---\n\n`);
      }

      const result = await orchestrator.orchestrate(task, subTasks, synthesizerName);

      if (saveAs) {
        const saveId = saveAs.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
        if (getApp(saveId)) {
          return {
            success: false,
            type: 'error',
            error: `App "${saveId}" already exists. Choose a different name.`,
          };
        }
        const builder = new AppBuilder(saveId, `${task.slice(0, 50)}...`)
          .describe(`Custom app created via /multiyolo: ${task.slice(0, 120)}`)
          .use(`/${saveId} <task>`)
          .examples([`/${saveId} ${task.slice(0, 60)}`]);
        for (const agent of agents) {
          builder.agent(agent.name, agent.role, agent.systemPrompt, agent.tools);
        }
        builder.register();
      }

      const lines: string[] = [];
      if (!context.onContentDelta) {
        lines.push(`## ⚡ Multi-Agent Orchestration (YOLO)`);
        lines.push(`**Task:** ${task}`);
        lines.push('');
      }

      for (const response of result.responses) {
        const agentCfg = agents.find(a => a.name === response.agentName);
        const role = agentCfg?.role || response.agentName;
        const toolHint = response.metadata?.toolCallsCount
          ? ` [${response.metadata.toolCallsCount} tool calls]`
          : '';
        const header = `### ${role}${toolHint}`;
        const duration = response.metadata?.durationMs
          ? `*${(response.metadata.durationMs / 1000).toFixed(1)}s*`
          : '';

        if (context.onContentDelta) {
          context.onContentDelta(`\n${header}\n`);
          if (duration) context.onContentDelta(`${duration}\n\n`);
          context.onContentDelta(`${response.content || '*No response*'}\n\n`);
        } else {
          lines.push(header);
          if (duration) lines.push(duration);
          lines.push('');
          lines.push(response.content || '*No response*');
          lines.push('');
        }
      }

      if (!context.onContentDelta) {
        lines.push('---');
        lines.push('### Synthesized Summary');
        lines.push('');
        lines.push(result.summary);
        lines.push('');
      } else {
        context.onContentDelta(`---\n\n### Synthesized Summary\n\n${result.summary}\n\n`);
      }

      const statusParts = [
        `${result.metadata.agentsUsed} agents`,
        `${(result.metadata.totalDurationMs / 1000).toFixed(1)}s`,
      ];
      if (result.metadata.totalTokens) {
        statusParts.push(`${result.metadata.totalTokens} tokens`);
      }
      if (saveAs) {
        const saveId = saveAs.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
        statusParts.push(`saved as /${saveId}`);
      }
      statusParts.push('YOLO mode');
      const statusLine = `*${statusParts.join(' · ')}*`;

      if (context.onContentDelta) {
        context.onContentDelta(`\n${statusLine}\n`);
        context.onContentDelta(`\n✅ **Multi-agent task complete! (YOLO mode)**\n`);
      } else {
        lines.push(statusLine);
        lines.push('');
        lines.push('✅ Multi-agent task complete! (YOLO mode)');
        return { success: true, type: 'info', content: lines.join('\n') };
      }

      return { success: true, type: 'silent' };
    } catch (error) {
      return {
        success: false,
        type: 'error',
        error: `/multiyolo failed: ${error instanceof Error ? error.message : String(error)}`,
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

  async handler(args: string, context: SlashCommandContext): Promise<SlashCommandResult> {
    const question = args?.trim();
    if (!question) return { success: false, type: 'error', error: 'Usage: /research <question>' };

    let modelConfig;
    try { modelConfig = requireModelConfig(); }
    catch (e) { return { success: false, type: 'error', error: (e as Error).message }; }

    // Build workspace source context so agents can reference real code
    const cwd = context.cwd || process.cwd();
    const sourceCtx = buildSourceContext(cwd);

    const baseModelCfg = { model: modelConfig.model, baseURL: modelConfig.baseURL || undefined, apiKey: modelConfig.apiKey };

    try {
      const council = new CouncilAgent('research-council', modelConfig, {
        rule: 'majority',
        maxTokensPerAgent: 800,
        enableIteration: false,
      });

      const researchTools = ['Read', 'Grep', 'Glob'];

      const researchNote = `\n\nWorkspace context (project metadata + file tree + structure summaries + git changes):\n${sourceCtx}\n\nRead files with Read tool, search with Grep, browse with Glob. Structure summaries show exports/classes/functions — use them to navigate. Git changes show what was recently modified.\nAlways state VOTE: approve, reject, or abstain and REASONING: with clear justification.`;

      council.addMember('analyst', 'Data Analyst',
        `You are a Data Analyst on a research council. You reason from data, statistics, and empirical evidence.\nYou value measurable outcomes and quantitative reasoning.${researchNote}`,
        1, baseModelCfg, researchTools);

      council.addMember('architect', 'Systems Architect',
        `You are a Systems Architect on a research council. You evaluate designs, tradeoffs, and architectural decisions.\nYou focus on scalability, maintainability, and system coherence.${researchNote}`,
        1, baseModelCfg, researchTools);

      council.addMember('ethicist', 'Ethics & Safety Officer',
        `You are an Ethics & Safety Officer on a research council. You evaluate safety, fairness, privacy, and societal impact.\nYou raise concerns others might miss and advocate for responsible practices.${researchNote}`,
        1, baseModelCfg, researchTools);

      council.addMember('pragmatist', 'Pragmatic Engineer',
        `You are a Pragmatic Engineer on a research council. You evaluate practicality, implementation effort, and real-world constraints.\nYou balance idealism with what actually works in production.${researchNote}`,
        1, baseModelCfg, researchTools);

      const result = await council.deliberate(question, context.sessionId);

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
      lines.push(result.synthesis.trim() || `${result.voteResults.length} perspectives gathered.`);
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
  description: 'View or manage semantic memory — /memory activate <token> | /memory stats | /memory load | /memory upload | /memory clear',
  category: 'config',
  usage: '/memory [activate <token> | stats | load <url|path> | upload | clear]',
  async handler(args: string, _context: SlashCommandContext): Promise<SlashCommandResult> {
    const fs   = await import('fs');
    const path = await import('path');
    const os   = await import('os');
    const { sharedMemory } = await import('../memory/SharedMemory.js');
    await sharedMemory.whenReady();

    const cfgPath = path.join(os.homedir(), '.aegiscode', 'config.json');
    const tokenPath = path.join(os.homedir(), '.aegiscode', 'memory.token');
    let cfg: any = {};
    try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
    const mem        = cfg?.memory ?? {};
    const subscribed = mem.subscribed === true || Boolean(process.env.AEGIS_MEMORY_TOKEN) || fs.existsSync(tokenPath);

    // /memory activate <token> — activate memory via Stripe payment token
    if (args?.startsWith('activate ')) {
      const token = args.replace('activate ', '').trim();
      if (token.length < 20) {
        return { success: false, type: 'error', error: 'Invalid token format — must be a valid signed JWT from Stripe checkout' };
      }

      try {
        fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
        fs.writeFileSync(tokenPath, token);
      } catch {}

      let email = 'stripe-user';
      let plan  = 'semantic-memory';
      let expiresAt: string | null = null;

      const apiKey = cfg?.aegiscloud?.api_key || process.env.AEGISCLOUD_API_KEY || '';
      const verifyUrl = process.env.AEGIS_VERIFY_URL || 'https://aegiscloud.org/api/verify-token';
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) headers['X-API-Key'] = apiKey;
        const res = await fetch(verifyUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ token }),
        });
        const result = await res.json();
        if (result.valid) {
          email = result.email || email;
          plan  = result.plan || plan;
          expiresAt = result.expiresAt || expiresAt;
        }
      } catch {}

      cfg.memory = {
        ...mem,
        subscribed: true,
        token,
        activatedAt: new Date().toISOString(),
        verifiedEmail: email,
        plan,
        expiresAt,
      };
      fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
      return { success: true, type: 'success', message: `✓ Memory activated — semantic search enabled (${email})` };
    }

    // /memory load <url|path> — load aegis export into local memory
    if (args?.startsWith('load ')) {
      const target = args.replace('load ', '').trim();
      try {
        let data: any;
        if (target.startsWith('http')) {
          const apiKey = cfg?.aegiscloud?.api_key || '';
          const res = await fetch(target, { headers: apiKey ? { 'X-API-Key': apiKey } : {} });
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

    // /memory upload — push every local memory to aegiscloud.org at once
    if (args?.trim() === 'upload') {
      const { total, pushed } = await sharedMemory.pushAll();
      if (total === 0) {
        return { success: true, type: 'info', message: 'No local memories to upload' };
      }
      if (pushed < total) {
        return { success: false, type: 'error', error: `Uploaded ${pushed}/${total} memories — some batches failed, try again` };
      }
      return { success: true, type: 'success', message: `✓ Uploaded ${pushed}/${total} memories to aegiscloud.org` };
    }

    // /memory clear
    if (args?.trim() === 'clear') {
      if (!subscribed) return { success: false, type: 'error', error: 'Not subscribed — use `/memory` to subscribe via Stripe' };
      sharedMemory.clear();
      cfg.memory = { ...mem, lastCleared: new Date().toISOString() };
      fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
      return { success: true, type: 'success', message: 'Memory cleared' };
    }

    // /memory stats
    if (args?.trim() === 'stats' && !subscribed) {
      return { success: false, type: 'error', error: 'Not subscribed — use `/memory` to subscribe via Stripe' };
    }

    // Not subscribed — open Stripe checkout
    if (!subscribed) {
      const stripeUrl = 'https://buy.stripe.com/14A4gB4J53vxcaV74S9R601';
      const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${openCmd} "${stripeUrl}"`, () => {});
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
          'Place the token in a file to activate:',
          `  mkdir -p ~/.aegiscode && echo '<your-token>' > ~/.aegiscode/memory.token`,
          '',
          'Or run:',
          '  `/memory activate <token>`',
          '',
          'No cloud server required — activation works offline.',
          'The token file is checked automatically on every command.',
        ].join('\n'),
      };
    }

    // Subscribed — show status
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
    lines.push('', '`/memory upload` — push all local memories to aegiscloud.org', '`/memory clear` — wipe all memories');

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
  usage: '/cloud [status | key <api_key> | activate | deactivate]',
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

    // /cloud sync on|off  (also: activate / deactivate)
    if (trimmed === 'sync on' || trimmed === 'activate' || trimmed === 'sync off' || trimmed === 'deactivate') {
      const enable = trimmed === 'sync on' || trimmed === 'activate';
      cfg.aegiscloud = { ...cloud, syncConversations: enable };
      fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
      return {
        success: true,
        type: 'success',
        message: `Cloud sync: ${enable ? '✓ activated — conversations will upload on exit' : '✗ deactivated'}`,
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
      lines.push('  `/cloud activate`   — enable auto-upload on exit');
      lines.push('  `/cloud deactivate` — disable auto-upload');
      lines.push('  `/cloud key <k>`    — update API key');
    }

    return { success: true, type: 'info', content: lines.join('\n') };
  },
};


const confirmCommand: SlashCommand = {
  name: 'confirm',
  aliases: ['confirmations'],
  description: 'Toggle the tool-call confirmation prompt for a model',
  category: 'config',
  usage: '/confirm [on|off] [model-id|claude|deepseek|all]',
  fullDescription:
    'Controls whether tool calls (Edit/Write/Bash) pause for your approval. ' +
    'No args shows status for the current model. Target can be a model id, ' +
    '`claude` (all anthropic-provider models), `deepseek` (all deepseek models), ' +
    'or `all`. Defaults to the current model.',
  examples: ['/confirm', '/confirm off', '/confirm off claude', '/confirm on all'],

  async handler(args: string): Promise<SlashCommandResult> {
    const { getState, configActions } = await import('../store/index.js');
    const state = getState();
    const config = state.config.config;
    const models = config?.models || [];
    const currentModelId = config?.currentModelId;

    const parts = args.trim().split(/\s+/).filter(Boolean);
    const arg = parts[0]?.toLowerCase();
    const target = parts[1]?.toLowerCase();

    // ── no args — show status for current model ──
    if (!arg) {
      const current = models.find(m => m.id === currentModelId);
      const enabled = current?.requireConfirmation !== false;
      return {
        success: true,
        type: 'info',
        content: `confirmation prompts for \`${currentModelId || 'current model'}\`: ${enabled ? 'on' : 'off'}\n\nuse \`/confirm on|off [model-id|claude|deepseek|all]\` to change`,
      };
    }

    if (arg !== 'on' && arg !== 'off') {
      return { success: false, type: 'error', content: 'usage: /confirm [on|off] [model-id|claude|deepseek|all]' };
    }
    const requireConfirmation = arg === 'on';

    const matchesTarget = (m: typeof models[number]): boolean => {
      if (!target) return m.id === currentModelId;
      if (target === 'all') return true;
      if (target === 'claude' || target === 'anthropic') return m.provider === 'anthropic';
      if (target === 'deepseek') return /deepseek/i.test(m.id || '') || /deepseek/i.test(m.baseURL || '');
      return m.id === target || m.model === target || m.name?.toLowerCase() === target;
    };

    const matched = models.filter(matchesTarget);
    if (matched.length === 0) {
      return { success: false, type: 'error', content: `no model matched \`${target || currentModelId}\`` };
    }

    const matchedIds = new Set(matched.map(m => m.id));
    const updatedModels = models.map(m =>
      matchedIds.has(m.id) ? { ...m, requireConfirmation } : m
    );

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

    const names = matched.map(m => m.id).join(', ');
    return {
      success: true,
      type: 'success',
      message: `confirmation prompts ${requireConfirmation ? 'enabled' : 'disabled'} for ${names}`,
    };
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

    // Update runtime state so next message picks up the change without reload
    configActions().updateConfig({ defaultPermissionMode: enable ? 'yolo' as const : 'default' as const });
    try {
      const { ConfigManager } = await import('../config/ConfigManager.js');
      ConfigManager.getInstance().setDefaultPermissionMode(enable ? 'yolo' : 'default');
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

// ─── AppBuilder-powered commands ────────────────────────────────────

function createAppCommand(app: AppDefinition): SlashCommand {
  return {
    name: app.id,
    description: app.description,
    category: 'general',
    usage: app.usage || `/${app.id} <task>`,
    examples: app.examples,
    fullDescription: `Runs a multi-agent app: **${app.name}**\n\nAgents: ${app.agents.map(a => `**${a.role}**`).join(' → ')}\n\nUses ${app.agents.length} specialist agents in parallel, then synthesizes results.`,

    async handler(args: string, context: SlashCommandContext): Promise<SlashCommandResult> {
      const task = args?.trim();
      if (!task) {
        return { success: false, type: 'error', error: `Usage: /${app.id} <task>\n\n${app.description}` };
      }
      try {
        const result = await runApp(app.id, {
          task,
          confirmationHandler: context.confirmationHandler,
        });
        const lines: string[] = [];

        // ── Status line ──
        const statusIcon = result.errorCount > 0 ? '⚠' : '✓';
        lines.push(`## ⬡ ${app.name}`);
        lines.push(`**Task:** ${task}`);
        lines.push(`*${result.responses.length} agents · ${(result.totalDurationMs / 1000).toFixed(1)}s · ${result.errorCount} error(s)*`);
        lines.push('');

        // ── Agent responses ──
        for (const response of result.responses) {
          const appCfg = app.agents.find(a => a.name === response.agentName);
          const role = appCfg?.role || response.agentName;
          const icon = result.errorCount > 0 && response.content.startsWith('[Error:') ? '⚠' : '▸';
          const toolHint = response.toolCallsCount ? ` [${response.toolCallsCount} tool calls]` : '';
          const header = `### ${icon} ${role}${toolHint}`;
          const duration = response.durationMs ? `*${(response.durationMs / 1000).toFixed(1)}s*` : '';

          if (context.onContentDelta) {
            context.onContentDelta(`\n${header}\n`);
            if (duration) context.onContentDelta(`${duration}\n\n`);
            context.onContentDelta(`${response.content || '*No response*'}\n\n`);
          } else {
            lines.push(header);
            if (duration) lines.push(duration);
            lines.push('');
            lines.push(response.content || '*No response*');
            lines.push('');
          }
        }

        // ── Summary ──
        if (!context.onContentDelta) {
          lines.push('---');
          lines.push('### Synthesis');
          lines.push('');
          lines.push(result.summary);
        } else {
          context.onContentDelta(`---\n\n### Synthesis\n\n${result.summary}\n\n`);
        }

        if (!context.onContentDelta) {
          return { success: true, type: 'info', content: lines.join('\n') };
        }
        return { success: true, type: 'silent' };
      } catch (error) {
        return {
          success: false,
          type: 'error',
          error: `/${app.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}



/** Generate SlashCommand wrappers for all AppBuilder apps */
const appCommands: SlashCommand[] = BUILTIN_APPS.map(createAppCommand);

// ─── Export all commands ───────────────────────────────────────────

export const builtinCommands: SlashCommand[] = [
  helpCommand,
  clearCommand,
  compactCommand,
  versionCommand,
  modelCommand,
  routerCommand,
  effortCommand,
  themeCommand,
  statusCommand,
  tokensCommand,
  skillsCommand,
  hooksCommand,
  thinkingCommand,
  copyCommand,
  memoryCommand,
  councilCommand,
  billingCommand,
  yoloCommand,
  confirmCommand,
  multiCommand,
  multiYoloCommand,
  researchCommand,
  buildCommand,
  cloneCommand,
  debateCommand,
  ...appCommands,
];
