/**
 * 
 * 
 * 
 * 
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  Config,
  ConfigSchema,
  DEFAULT_CONFIG,
  ModelConfig,
  type PermissionConfig,
  type McpServerConfig,
} from './types.js';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;
  private configPaths: string[] = [];

  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * 
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 
   */
  async initialize(projectPath?: string): Promise<Config> {
    this.config = { ...DEFAULT_CONFIG };

    const userConfigDir = this.getUserConfigDir();
    const projectDir = projectPath || process.cwd();
    const projectConfigDir = path.join(projectDir, '.aegiscode');
    await this.loadConfigFile(path.join(userConfigDir, 'config.json'));
    await this.loadConfigFile(path.join(userConfigDir, 'settings.json'));
    await this.loadConfigFile(path.join(projectConfigDir, 'config.json'));
    await this.loadConfigFile(path.join(projectConfigDir, 'settings.json'));
    await this.loadConfigFile(path.join(projectConfigDir, 'settings.local.json'));
    this.applyEnvironmentVariables();

    return this.config;
  }

  /**
   * 
   */
  getUserConfigDir(): string {
    return path.join(os.homedir(), '.aegiscode');
  }

  /**
   * 
   */
  getUserConfigPath(): string {
    return path.join(this.getUserConfigDir(), 'config.json');
  }

  /**
   * 
   */
  private async loadConfigFile(configPath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(configPath)) {
        return false;
      }

      const content = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content);

      // Backward compat: if root has apiKey/baseURL/model, wrap in 'default'
      if (parsed.apiKey || parsed.baseURL || parsed.baseUrl || parsed.model) {
        if (!parsed.default) {
          parsed.default = {};
        }
        if (parsed.apiKey && !parsed.default.apiKey) parsed.default.apiKey = parsed.apiKey;
        if (parsed.baseURL && !parsed.default.baseURL) parsed.default.baseURL = parsed.baseURL;
        if (parsed.baseUrl && !parsed.default.baseURL) parsed.default.baseURL = parsed.baseUrl;
        if (parsed.model && !parsed.default.model) parsed.default.model = parsed.model;
      }

      const validated = ConfigSchema.partial().parse(parsed);
      this.config = this.mergeConfig(this.config, validated);
      this.configPaths.push(configPath);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 
   */
  private applyEnvironmentVariables(): void {
    // Load ~/.aegiscode/.env
    try {
      const lines = (fs.existsSync(path.join(os.homedir(), '.aegiscode', '.env')) ? fs.readFileSync(path.join(os.homedir(), '.aegiscode', '.env'), 'utf8') : '').split('\n');
      for (const line of lines) {
        const eq = line.indexOf('=');
        if (eq < 0 || line.trim().startsWith('#')) continue;
        const k = line.slice(0, eq).trim();
        const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (k && v && !process.env[k]) process.env[k] = v;
      }
    } catch {}

    this.config.default = this.config.default || {};
    const defaultConfig = this.config.default;

    // Normalize baseUrl -> baseURL
    if (!defaultConfig.baseURL && (defaultConfig as any).baseUrl) {
      defaultConfig.baseURL = (defaultConfig as any).baseUrl;
    }

    // Inject env keys into each model by provider
    const allModels: any[] = (this.config as any).models || [];
    for (const m of allModels) {
      const bu: string = m.baseURL || m.baseUrl || '';
      if (bu.includes('anthropic') && process.env.ANTHROPIC_API_KEY) {
        m.apiKey = process.env.ANTHROPIC_API_KEY;
      } else if (bu.includes('deepseek') && process.env.DEEPSEEK_API_KEY) {
        m.apiKey = process.env.DEEPSEEK_API_KEY;
      } else if (bu.includes('groq') && process.env.GROQ_API_KEY) {
        m.apiKey = process.env.GROQ_API_KEY;
      } else if (bu.includes('openai') && process.env.OPENAI_API_KEY) {
        m.apiKey = process.env.OPENAI_API_KEY;
      }
    }
    // Use currentModelId to pick the right default — don't override with env key priority
    if (!defaultConfig.apiKey) {
      const currentId = (this.config as any).currentModelId;
      const currentModel = allModels.find((m: any) => m.id === currentId);
      if (currentModel && currentModel.apiKey) {
        defaultConfig.apiKey  = currentModel.apiKey;
        defaultConfig.baseURL = currentModel.baseURL || currentModel.baseUrl;
        defaultConfig.model   = currentModel.model;
      } else if (process.env.DEEPSEEK_API_KEY) {
        defaultConfig.apiKey  = process.env.DEEPSEEK_API_KEY;
        defaultConfig.baseURL = 'https://api.deepseek.com/v1';
        defaultConfig.model   = 'deepseek-chat';
      } else if (process.env.ANTHROPIC_API_KEY) {
        defaultConfig.apiKey  = process.env.ANTHROPIC_API_KEY;
        defaultConfig.baseURL = 'https://api.anthropic.com/v1';
        defaultConfig.model   = 'claude-sonnet-4-6';
      } else if (process.env.GROQ_API_KEY) {
        defaultConfig.apiKey  = process.env.GROQ_API_KEY;
        defaultConfig.baseURL = 'https://api.groq.com/openai/v1';
        defaultConfig.model   = 'llama-3.3-70b-versatile';
      } else if (process.env.OPENAI_API_KEY) {
        defaultConfig.apiKey  = process.env.OPENAI_API_KEY;
        if (process.env.OPENAI_BASE_URL) defaultConfig.baseURL = process.env.OPENAI_BASE_URL;
        if (process.env.OPENAI_MODEL)    defaultConfig.model   = process.env.OPENAI_MODEL;
        else if (!defaultConfig.model)   defaultConfig.model   = 'gpt-4o';
      }
    }
  }

  /**
   * 
   */
  applyCliArgs(args: Partial<ModelConfig>): void {
    this.config.default = this.config.default || {};
    const defaultConfig = this.config.default;

    if (args.apiKey) {
      defaultConfig.apiKey = args.apiKey;
    }
    if (args.baseURL) {
      defaultConfig.baseURL = args.baseURL;
    }
    if (args.model) {
      defaultConfig.model = args.model;
    }
  }

  /**
   * 
   */
  private mergeConfig(base: Config, override: Partial<Config>): Config {
    const merged: Config = {
      ...base,
    };

    if (override.default || base.default) {
      merged.default = {
        ...base.default,
        ...override.default,
      };
    }

    if (override.models) {
      merged.models = override.models;
    }

    if (override.ui || base.ui) {
      merged.ui = {
        ...base.ui,
        ...override.ui,
      };
    }
    if (override.permissions || base.permissions) {
      merged.permissions = {
        allow: [
          ...(base.permissions?.allow || []),
          ...(override.permissions?.allow || []),
        ],
        deny: [
          ...(base.permissions?.deny || []),
          ...(override.permissions?.deny || []),
        ],
        ask: [
          ...(base.permissions?.ask || []),
          ...(override.permissions?.ask || []),
        ],
      };
    }

    // currentModelId — explicit merge
    if ((override as any).currentModelId) {
      (merged as any).currentModelId = (override as any).currentModelId;
    }
    if (override.defaultPermissionMode) {
      merged.defaultPermissionMode = override.defaultPermissionMode;
    }
    if (override.toolWhitelist) {
      merged.toolWhitelist = override.toolWhitelist;
    }
    if (override.toolBlacklist) {
      merged.toolBlacklist = override.toolBlacklist;
    }
    if (override.mcpServers || base.mcpServers) {
      merged.mcpServers = {
        ...(base.mcpServers || {}),
        ...(override.mcpServers || {}),
      };
    }
    if (override.mcpEnabled !== undefined) {
      merged.mcpEnabled = override.mcpEnabled;
    }
    if (override.hooks || base.hooks) {
      merged.hooks = {
        ...(base.hooks || {}),
        ...(override.hooks || {}),
      };
    }

    return merged;
  }

  /**
   * 
   */
  getConfig(): Config {
    return this.config;
  }

  /**
   * 
   */
  getDefaultModel(): ModelConfig {
    // Prefer currentModelId from config
    // Läs currentModelId direkt från fil (Zod strippar det)
    let currentId = (this.config as any).currentModelId;
    if (!currentId) {
      try {
        const raw = JSON.parse(fs.readFileSync(
          path.join(os.homedir(), '.aegiscode', 'config.json'), 'utf8'
        ));
        currentId = raw.currentModelId;
      } catch {}
    }
    const models: any[] = (this.config as any).models || [];
    if (currentId && models.length > 0) {
      const found = models.find((m: any) => m.id === currentId);
      if (found) {
        const result: any = { ...found };
        if (!result.baseURL && result.baseUrl) result.baseURL = result.baseUrl;
        return result;
      }
    }
    // Fallback to default
    const base: any = { ...(this.config.default ?? {}) };
    if (!base.baseURL && base.baseUrl) base.baseURL = base.baseUrl;
    return base;
  }

  /**
   * 
   */
  getLoadedConfigPaths(): string[] {
    return [...this.configPaths];
  }

  /**
   * 
   */
  getPermissionConfig(): PermissionConfig {
    return this.config.permissions || { allow: [], deny: [], ask: [] };
  }

  /**
   * 
   */
  getDefaultPermissionMode(): string {
    return this.config.defaultPermissionMode || 'default';
  }

  /**
   * 
   */
  getMcpServers(): Record<string, McpServerConfig> {
    return this.config.mcpServers || {};
  }

  /**
   * 
   */
  isMcpEnabled(): boolean {
    return this.config.mcpEnabled !== false;
  }

  /**
   * 
   */
  async createDefaultConfig(): Promise<string> {
    const configDir = this.getUserConfigDir();
    const configPath = this.getUserConfigPath();
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const defaultConfig: Config = {
      default: {
        model: 'claude-sonnet-4-20250514',
        // baseURL: 'https://api.openai.com/v1',
      },
      ui: {
        theme: 'dark',
      },
      mcpEnabled: true,
      mcpServers: {
        // github: {
        //   type: 'stdio',
        //   command: 'npx',
        //   args: ['-y', '@modelcontextprotocol/server-github'],
        //   env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' },
        // },
      },
    };

    const content = JSON.stringify(defaultConfig, null, 2);
    fs.writeFileSync(configPath, content, 'utf-8');

    return configPath;
  }

  /**
   * 
   */
  isConfigValid(): boolean {
    return !!this.config.default?.apiKey;
  }

  /**
   * 
   * 
   * 
   * 
   */
  getTheme(): string | null {
    const userConfigPath = this.getUserConfigPath();
    
    if (fs.existsSync(userConfigPath)) {
      try {
        const content = fs.readFileSync(userConfigPath, 'utf-8');
        const userConfig = JSON.parse(content);
        if (userConfig.theme) {
          return userConfig.theme;
        }
        if (userConfig.ui?.theme) {
          return userConfig.ui.theme;
        }
      } catch {
      }
    }
    return null;
  }

  /**
   * 
   */
  saveTheme(themeName: string): void {
    const configPath = this.getUserConfigPath();
    const configDir = this.getUserConfigDir();
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    let existingConfig: Partial<Config> = {};
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        existingConfig = JSON.parse(content);
      } catch {
      }
    }
    existingConfig.theme = themeName;
    if (!existingConfig.ui) {
      existingConfig.ui = {};
    }
    existingConfig.ui.theme = themeName;
    this.config.theme = themeName;
    if (this.config.ui) {
      this.config.ui.theme = themeName;
    }
    const content = JSON.stringify(existingConfig, null, 2);
    fs.writeFileSync(configPath, content, 'utf-8');
  }
}
export const configManager = ConfigManager.getInstance();
