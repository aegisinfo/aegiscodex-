/**
 * 
 * 
 * 
 * 
 */

import { execSync } from 'node:child_process';
import type { Theme, ThemePreset, RoleStyle, ColorMode } from './types.js';
import { defaultTheme } from './defaultTheme.js';
import { darkTheme } from './darkTheme.js';
import { lightTheme } from './lightTheme.js';
import { configManager } from '../../config/ConfigManager.js';

/**
 * 
 * 
 * 
 */
function detectColorMode(): ColorMode {
  if (process.platform === 'darwin') {
    try {
      const result = execSync('defaults read -g AppleInterfaceStyle 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 1000,
      }).trim();
      if (result === 'Dark') {
        return 'dark';
      }
    } catch {
      return 'light';
    }
  }
  const colorFgBg = process.env.COLORFGBG;
  if (colorFgBg) {
    const parts = colorFgBg.split(';');
    if (parts.length >= 2) {
      const bg = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(bg)) {
        if (bg === 0 || bg <= 6) {
          return 'dark';
        } else if (bg === 7 || bg >= 8) {
          return 'light';
        }
      }
    }
  }
  const termProgram = process.env.TERM_PROGRAM?.toLowerCase();
  if (termProgram) {
    if (termProgram === 'vscode') {
      const themeKind = process.env.VSCODE_THEME_KIND;
      if (themeKind === 'vscode-dark' || themeKind === 'vscode-high-contrast') {
        return 'dark';
      } else if (themeKind === 'vscode-light' || themeKind === 'vscode-high-contrast-light') {
        return 'light';
      }
    }
  }

  return 'unknown';
}

/**
 * 
 */
const presetThemes: ThemePreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Balanced theme (works on most terminals)',
    theme: defaultTheme,
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Optimized for light/white terminal backgrounds',
    theme: lightTheme,
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Dark theme for dark terminal backgrounds',
    theme: darkTheme,
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Deep blue ocean theme',
    theme: {
      ...darkTheme,
      name: 'ocean',
      colors: {
        ...darkTheme.colors,
        primary: '#0ea5e9',      // sky-500
        secondary: '#06b6d4',    // cyan-500
        accent: '#14b8a6',       // teal-500
        background: {
          primary: '#0c4a6e',    // sky-900
          secondary: '#075985',  // sky-800
          dark: '#082f49',       // sky-950
        },
      },
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Natural green forest theme',
    theme: {
      ...darkTheme,
      name: 'forest',
      colors: {
        ...darkTheme.colors,
        primary: '#22c55e',      // green-500
        secondary: '#16a34a',    // green-600
        accent: '#84cc16',       // lime-500
        background: {
          primary: '#14532d',    // green-900
          secondary: '#166534',  // green-800
          dark: '#052e16',       // green-950
        },
      },
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm sunset colors',
    theme: {
      ...darkTheme,
      name: 'sunset',
      colors: {
        ...darkTheme.colors,
        primary: '#f97316',      // orange-500
        secondary: '#ea580c',    // orange-600
        accent: '#eab308',       // yellow-500
        background: {
          primary: '#7c2d12',    // orange-900
          secondary: '#9a3412',  // orange-800
          dark: '#431407',       // orange-950
        },
      },
    },
  },
];

/**
 * 
 */
export class ThemeManager {
  private currentTheme: Theme = defaultTheme;
  private themes: Map<string, Theme> = new Map();
  private initialized: boolean = false;

  constructor() {
    for (const preset of presetThemes) {
      this.themes.set(preset.id, preset.theme);
    }
  }

  /**
   * 
   * 
   * 
   */
  initializeFromConfig(): void {
    if (this.initialized) return;
    
    try {
      const savedTheme = configManager.getTheme();
      if (savedTheme && this.themes.has(savedTheme)) {
        this.currentTheme = this.themes.get(savedTheme)!;
        this.initialized = true;
        return;
      }
      const colorMode = detectColorMode();
      
      if (colorMode === 'dark') {
        this.currentTheme = this.themes.get('dark')!;
      } else if (colorMode === 'light') {
        this.currentTheme = this.themes.get('light')!;
      }
      
      this.initialized = true;
    } catch {
      this.initialized = true;
    }
  }
  
  /**
   * 
   */
  getDetectedColorMode(): ColorMode {
    return detectColorMode();
  }

  /**
   * 
   */
  setTheme(themeName: string, persist: boolean = true): void {
    const theme = this.themes.get(themeName);
    if (theme) {
      this.currentTheme = theme;
      if (persist) {
        try {
          configManager.saveTheme(themeName);
        } catch {
        }
      }
    } else {
      throw new Error(`Theme '${themeName}' not found`);
    }
  }

  /**
   * 
   */
  getTheme(): Theme {
    return this.currentTheme;
  }

  /**
   * 
   */
  getCurrentThemeName(): string {
    return this.currentTheme.name;
  }

  /**
   * 
   */
  hasTheme(themeName: string): boolean {
    return this.themes.has(themeName);
  }

  /**
   * 
   */
  getAvailableThemes(): string[] {
    return Array.from(this.themes.keys());
  }

  /**
   * 
   */
  getThemePresets(): ThemePreset[] {
    return presetThemes;
  }

  /**
   * 
   */
  registerTheme(id: string, theme: Theme): void {
    this.themes.set(id, theme);
  }

  /**
   * 
   */
  getRoleStyle(role: 'user' | 'assistant' | 'system' | 'tool'): RoleStyle {
    const colors = this.currentTheme.colors;
    
    switch (role) {
      case 'user':
        return {
          color: colors.success,
          prefix: '› ',
          bold: false,
        };
      case 'assistant':
        return {
          color: colors.primary,
          prefix: '> ',
          bold: false,
        };
      case 'system':
        return {
          color: colors.warning,
          prefix: '! ',
          bold: true,
        };
      case 'tool':
        return {
          color: colors.info,
          prefix: '→ ',
          bold: false,
        };
      default:
        return {
          color: colors.text.primary,
          prefix: '',
        };
    }
  }
}
export const themeManager = new ThemeManager();
