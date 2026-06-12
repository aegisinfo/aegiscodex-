/**
 * ConfigManager - 配置管理器（双文件配置架构）
 *
 *
 * - config.json: 基础配置（API、模型、UI、MCP）
 * - settings.json: 行为配置（权限、Hooks、环境变量）
 * - settings.local.json: 本地行为配置（不提交到 Git）
 *
 *
 * 1. 默认配置
 * 2. 用户 config.json (~/.aegiscode/config.json)
 * 3. 用户 settings.json (~/.aegiscode/settings.json)
 * 4. 项目 config.json (./.aegiscode/config.json)
 * 5. 项目 settings.json (./.aegiscode/settings.json)
 * 6. 本地 settings.local.json (./.aegiscode/settings.local.json)
 * 7. 环境变量
 * 8. CLI 参数
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ConfigSchema, DEFAULT_CONFIG, } from './types.js';
export class ConfigManager {
    static instance;
    config;
    configPaths = [];
    constructor() {
        this.config = { ...DEFAULT_CONFIG };
    }
    /**
     *
     */
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    /**
     *
     * @returns 加载后的配置
     */
    async initialize(projectPath) {
        // 1. 从默认配置开
        this.config = { ...DEFAULT_CONFIG };
        const userConfigDir = this.getUserConfigDir();
        const projectDir = projectPath || process.cwd();
        const projectConfigDir = path.join(projectDir, '.aegiscode');
        // 2. 加载用
        await this.loadConfigFile(path.join(userConfigDir, 'config.json'));
        // 3. 加载用
        await this.loadConfigFile(path.join(userConfigDir, 'settings.json'));
        // 4. 加载项
        await this.loadConfigFile(path.join(projectConfigDir, 'config.json'));
        // 5. 加载项
        await this.loadConfigFile(path.join(projectConfigDir, 'settings.json'));
        // 6. 加载本地 settings.local.json（不提交
        await this.loadConfigFile(path.join(projectConfigDir, 'settings.local.json'));
        // 7. 应用环境变
        this.applyEnvironmentVariables();
        return this.config;
    }
    /**
     *
     */
    getUserConfigDir() {
        return path.join(os.homedir(), '.aegiscode');
    }
    /**
     *
     */
    getUserConfigPath() {
        return path.join(this.getUserConfigDir(), 'config.json');
    }
    /**
     *
     */
    async loadConfigFile(configPath) {
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
                if (parsed.apiKey && !parsed.default.apiKey)
                    parsed.default.apiKey = parsed.apiKey;
                if (parsed.baseURL && !parsed.default.baseURL)
                    parsed.default.baseURL = parsed.baseURL;
                if (parsed.baseUrl && !parsed.default.baseURL)
                    parsed.default.baseURL = parsed.baseUrl;
                if (parsed.model && !parsed.default.model)
                    parsed.default.model = parsed.model;
            }
            const validated = ConfigSchema.partial().parse(parsed);
            // 深度合并配
            this.config = this.mergeConfig(this.config, validated);
            this.configPaths.push(configPath);
            return true;
        }
        catch (error) {
            console.warn(`Warning: Failed to load config from ${configPath}:`, error.message);
            return false;
        }
    }
    /**
     *
     */
    applyEnvironmentVariables() {
        // Load ~/.aegiscode/.env
        try {
            const lines = (fs.existsSync(path.join(os.homedir(), '.aegiscode', '.env')) ? fs.readFileSync(path.join(os.homedir(), '.aegiscode', '.env'), 'utf8') : '').split('\n');
            for (const line of lines) {
                const eq = line.indexOf('=');
                if (eq < 0 || line.trim().startsWith('#'))
                    continue;
                const k = line.slice(0, eq).trim();
                const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
                if (k && v && !process.env[k])
                    process.env[k] = v;
            }
        }
        catch { }
        this.config.default = this.config.default || {};
        const defaultConfig = this.config.default;
        // Normalize baseUrl -> baseURL
        if (!defaultConfig.baseURL && defaultConfig.baseUrl) {
            defaultConfig.baseURL = defaultConfig.baseUrl;
        }
        // Inject env keys into each model by provider
        const allModels = this.config.models || [];
        for (const m of allModels) {
            const bu = m.baseURL || m.baseUrl || '';
            if (bu.includes('anthropic') && process.env.ANTHROPIC_API_KEY) {
                m.apiKey = process.env.ANTHROPIC_API_KEY;
            }
            else if (bu.includes('deepseek') && process.env.DEEPSEEK_API_KEY) {
                m.apiKey = process.env.DEEPSEEK_API_KEY;
            }
            else if (bu.includes('groq') && process.env.GROQ_API_KEY) {
                m.apiKey = process.env.GROQ_API_KEY;
            }
            else if (bu.includes('googleapis') && process.env.GEMINI_API_KEY) {
                m.apiKey = process.env.GEMINI_API_KEY;
            }
            else if (bu.includes('openai') && process.env.OPENAI_API_KEY) {
                m.apiKey = process.env.OPENAI_API_KEY;
            }
        }
        // Use currentModelId to pick the right default — don't override with env key priority
        if (!defaultConfig.apiKey) {
            const currentId = this.config.currentModelId;
            const currentModel = allModels.find((m) => m.id === currentId);
            if (currentModel && currentModel.apiKey) {
                defaultConfig.apiKey = currentModel.apiKey;
                defaultConfig.baseURL = currentModel.baseURL || currentModel.baseUrl;
                defaultConfig.model = currentModel.model;
            }
            else if (process.env.DEEPSEEK_API_KEY) {
                defaultConfig.apiKey = process.env.DEEPSEEK_API_KEY;
                defaultConfig.baseURL = 'https://api.deepseek.com/v1';
                defaultConfig.model = 'deepseek-chat';
            }
            else if (process.env.GROQ_API_KEY) {
                defaultConfig.apiKey = process.env.GROQ_API_KEY;
                defaultConfig.baseURL = 'https://api.groq.com/openai/v1';
                defaultConfig.model = 'llama-3.3-70b-versatile';
            }
            else if (process.env.OPENAI_API_KEY) {
                defaultConfig.apiKey = process.env.OPENAI_API_KEY;
                if (process.env.OPENAI_BASE_URL)
                    defaultConfig.baseURL = process.env.OPENAI_BASE_URL;
                if (process.env.OPENAI_MODEL)
                    defaultConfig.model = process.env.OPENAI_MODEL;
                else if (!defaultConfig.model)
                    defaultConfig.model = 'gpt-4o';
            }
            else if (process.env.ANTHROPIC_API_KEY) {
                defaultConfig.apiKey = process.env.ANTHROPIC_API_KEY;
                defaultConfig.baseURL = 'https://api.anthropic.com/v1';
                defaultConfig.model = 'claude-sonnet-4-6';
            }
        }
    }
    /**
     *
     */
    applyCliArgs(args) {
        this.config.default = this.config.default || {};
        const defaultConfig = this.config.default;
        if (args.apiKey) {
            defaultConfig.apiKey = args.apiKey;
        }
        if (args.baseURL) {
            defaultConfig.baseURL = args.baseURL;
        }
        if (args.model) {
            const models = this.config.models || [];
            const found = models.find((m) => m.id === args.model || m.model === args.model);
            if (found) {
                // args.model is a model ID — switch fully to that model's config
                this.config.currentModelId = found.id;
                this.config.default = { ...defaultConfig, ...found };
            }
            else {
                defaultConfig.model = args.model;
            }
        }
    }
    /**
     *
     */
    mergeConfig(base, override) {
        const merged = {
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
        // 合并权限配置（数组合并而非覆
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
        if (override.currentModelId) {
            merged.currentModelId = override.currentModelId;
        }
        // 其他字段使用后者覆
        if (override.defaultPermissionMode) {
            merged.defaultPermissionMode = override.defaultPermissionMode;
        }
        if (override.toolWhitelist) {
            merged.toolWhitelist = override.toolWhitelist;
        }
        if (override.toolBlacklist) {
            merged.toolBlacklist = override.toolBlacklist;
        }
        // 合并 MCP 服务器配置（深度合
        if (override.mcpServers || base.mcpServers) {
            merged.mcpServers = {
                ...(base.mcpServers || {}),
                ...(override.mcpServers || {}),
            };
        }
        // MCP 启用状
        if (override.mcpEnabled !== undefined) {
            merged.mcpEnabled = override.mcpEnabled;
        }
        // 合并 Hooks 配置（深度合
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
    getConfig() {
        return this.config;
    }
    /**
     *
     */
    getDefaultModel() {
        // Prefer currentModelId from config
        // Läs currentModelId direkt från fil (Zod strippar det)
        let currentId = this.config.currentModelId;
        if (!currentId) {
            try {
                const raw = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.aegiscode', 'config.json'), 'utf8'));
                currentId = raw.currentModelId;
            }
            catch { }
        }
        const models = this.config.models || [];
        if (currentId && models.length > 0) {
            let found = models.find((m) => m.id === currentId);
            // Fallback: match by model name
            if (!found)
                found = models.find((m) => m.model === currentId);
            if (found) {
                const result = { ...found };
                if (!result.baseURL && result.baseUrl)
                    result.baseURL = result.baseUrl;
                return result;
            }
        }
        // Fallback to default
        const base = { ...(this.config.default ?? {}) };
        if (!base.baseURL && base.baseUrl)
            base.baseURL = base.baseUrl;
        return base;
    }
    /**
     *
     */
    getLoadedConfigPaths() {
        return [...this.configPaths];
    }
    /**
     *
     */
    getPermissionConfig() {
        return this.config.permissions || { allow: [], deny: [], ask: [] };
    }
    /**
     *
     */
    getDefaultPermissionMode() {
        return this.config.defaultPermissionMode || 'default';
    }
    /**
     *
     */
    getMcpServers() {
        return this.config.mcpServers || {};
    }
    /**
     *
     */
    isMcpEnabled() {
        return this.config.mcpEnabled !== false;
    }
    /**
     *
     */
    async createDefaultConfig() {
        const configDir = this.getUserConfigDir();
        const configPath = this.getUserConfigPath();
        // 创建目
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        // 写入默认配置（不包含敏感信
        const defaultConfig = {
            default: {
                model: 'claude-sonnet-4-6',
                // apiKey: 'your-api-key',  // 需要用户自己填
                // baseURL: 'https://api.openai.com/v1',
            },
            ui: {
                theme: 'dark',
            },
            mcpEnabled: true,
            mcpServers: {
            // 示例 MCP 服务器配置（已注
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
    isConfigValid() {
        return !!this.config.default?.apiKey;
    }
    /**
     *
     *
     *
     *
     */
    getTheme() {
        // 优先读取用户配置中的主题（用户主动设置
        const userConfigPath = this.getUserConfigPath();
        if (fs.existsSync(userConfigPath)) {
            try {
                const content = fs.readFileSync(userConfigPath, 'utf-8');
                const userConfig = JSON.parse(content);
                // 如果用户配置中有明确设置的主题，使用
                if (userConfig.theme) {
                    return userConfig.theme;
                }
                if (userConfig.ui?.theme) {
                    return userConfig.ui.theme;
                }
            }
            catch {
                // 解析失败，返
            }
        }
        // 没有用户设置的主题，返回 null 表示应该自动检
        return null;
    }
    /**
     *
     */
    saveTheme(themeName) {
        const configPath = this.getUserConfigPath();
        const configDir = this.getUserConfigDir();
        // 确保目录存
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        // 读取现有配置或创建新配
        let existingConfig = {};
        if (fs.existsSync(configPath)) {
            try {
                const content = fs.readFileSync(configPath, 'utf-8');
                existingConfig = JSON.parse(content);
            }
            catch {
                // 如果解析失败，使用空配
            }
        }
        // 更新主
        existingConfig.theme = themeName;
        if (!existingConfig.ui) {
            existingConfig.ui = {};
        }
        existingConfig.ui.theme = themeName;
        // 同时更新内存中的配
        this.config.theme = themeName;
        if (this.config.ui) {
            this.config.ui.theme = themeName;
        }
        // 写入文
        const content = JSON.stringify(existingConfig, null, 2);
        fs.writeFileSync(configPath, content, 'utf-8');
    }
}
// 导出单
export const configManager = ConfigManager.getInstance();
//# sourceMappingURL=ConfigManager.js.map