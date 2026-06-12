/**
 *
 *
 *
 *
 */
import type { Theme, ThemePreset, RoleStyle, ColorMode } from './types.js';
/**
 *
 */
export declare class ThemeManager {
    private currentTheme;
    private themes;
    private initialized;
    constructor();
    /**
     *
     *
     *
     * 1. 用户保存的主题（用户配置文件中）
     * 2. 自动检测终端颜色模式，选择合适的主题
     * 3. 使用默认主题
     */
    initializeFromConfig(): void;
    /**
     *
     */
    getDetectedColorMode(): ColorMode;
    /**
     *
     */
    setTheme(themeName: string, persist?: boolean): void;
    /**
     *
     */
    getTheme(): Theme;
    /**
     *
     */
    getCurrentThemeName(): string;
    /**
     *
     */
    hasTheme(themeName: string): boolean;
    /**
     *
     */
    getAvailableThemes(): string[];
    /**
     *
     */
    getThemePresets(): ThemePreset[];
    /**
     *
     */
    registerTheme(id: string, theme: Theme): void;
    /**
     *
     */
    getRoleStyle(role: 'user' | 'assistant' | 'system' | 'tool'): RoleStyle;
}
export declare const themeManager: ThemeManager;
//# sourceMappingURL=ThemeManager.d.ts.map