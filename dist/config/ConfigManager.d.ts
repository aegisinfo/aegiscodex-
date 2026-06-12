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
import { Config, ModelConfig, type PermissionConfig, type McpServerConfig } from './types.js';
export declare class ConfigManager {
    private static instance;
    private config;
    private configPaths;
    private constructor();
    /**
     *
     */
    static getInstance(): ConfigManager;
    /**
     *
     * @returns 加载后的配置
     */
    initialize(projectPath?: string): Promise<Config>;
    /**
     *
     */
    getUserConfigDir(): string;
    /**
     *
     */
    getUserConfigPath(): string;
    /**
     *
     */
    private loadConfigFile;
    /**
     *
     */
    private applyEnvironmentVariables;
    /**
     *
     */
    applyCliArgs(args: Partial<ModelConfig>): void;
    /**
     *
     */
    private mergeConfig;
    /**
     *
     */
    getConfig(): Config;
    /**
     *
     */
    getDefaultModel(): ModelConfig;
    /**
     *
     */
    getLoadedConfigPaths(): string[];
    /**
     *
     */
    getPermissionConfig(): PermissionConfig;
    /**
     *
     */
    getDefaultPermissionMode(): string;
    /**
     *
     */
    getMcpServers(): Record<string, McpServerConfig>;
    /**
     *
     */
    isMcpEnabled(): boolean;
    /**
     *
     */
    createDefaultConfig(): Promise<string>;
    /**
     *
     */
    isConfigValid(): boolean;
    /**
     *
     *
     *
     *
     */
    getTheme(): string | null;
    /**
     *
     */
    saveTheme(themeName: string): void;
}
export declare const configManager: ConfigManager;
//# sourceMappingURL=ConfigManager.d.ts.map