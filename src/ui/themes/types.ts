/**
 * Theme type definitions
 *
 * Extended with design tokens for consistent spacing, elevation, and semantic colors.
 */

export type ColorMode = 'dark' | 'light' | 'unknown';

export interface SyntaxColors {
  comment: string;
  string: string;
  number: string;
  keyword: string;
  function: string;
  variable: string;
  operator: string;
  type: string;
  tag: string;
  attr: string;
  default: string;
}

export interface BaseColors {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  text: {
    primary: string;
    secondary: string;
    muted: string;
    light: string;
  };
  background: {
    primary: string;
    secondary: string;
    dark: string;
  };
  border: {
    light: string;
    dark: string;
  };
  syntax: SyntaxColors;
}

export interface Spacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

// ========== Design Tokens (new) ==========

/** Elevation / shadow depth for panels, modals, overlays */
export interface ElevationTokens {
  flat: string;      // No elevation (background surface)
  raised: string;    // Cards, panels
  overlay: string;   // Modals, dialogs
  sticky: string;    // Status bars, headers that should stand out
}

/** Border radius tokens */
export interface RadiusTokens {
  sm: number;
  md: number;
  lg: number;
  full: number;
}

/** Animation / transition tokens */
export interface AnimationTokens {
  fast: number;      // ms — hover, micro-interactions
  normal: number;    // ms — standard transitions
  slow: number;      // ms — page/appear transitions
  easing: string;    // CSS easing function name or cubic-bezier
}

/** Semantic color roles */
export interface SemanticTokens {
  /** Interactive element states */
  interactive: {
    idle: string;
    hover: string;
    active: string;
    disabled: string;
  };
  /** Focus ring */
  focus: {
    ring: string;
    glow: string;
  };
  /** Code block styling */
  code: {
    background: string;
    border: string;
  };
}

export interface DesignTokens {
  elevation: ElevationTokens;
  radius: RadiusTokens;
  animation: AnimationTokens;
  semantic: SemanticTokens;
}

export interface Theme {
  name: string;
  colors: BaseColors;
  spacing: Spacing;
  /** Optional design tokens for fine-grained UI control */
  tokens?: DesignTokens;
}

export interface RoleStyle {
  color: string;
  prefix: string;
  bold?: boolean;
}

export interface ThemePreset {
  id: string;
  name: string;
  description?: string;
  theme: Theme;
}
