import type { Theme, BaseColors, Spacing } from './types.js';

const aegisColors: BaseColors = {
  primary: '#00e5c0',      // teal
  secondary: '#7c6fd4',    // purple
  accent: '#00e5c0',       // teal
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#00e5c0',
  text: {
    primary: '#e8e6f4',
    secondary: '#8882a4',
    muted: '#44405a',
    light: '#e8e6f4',
  },
  background: {
    primary: '#04040c',
    secondary: '#181828',
    dark: '#0c0c16',
  },
  border: {
    light: 'rgba(255,255,255,0.06)',
    dark: '#1a1a2a',
  },
  syntax: {
    keyword: '#00e5c0',
    string: '#7c6fd4',
    number: '#f59e0b',
    comment: '#44405a',
    function: '#f472b6',
    variable: '#e8e6f4',
    operator: '#89DDFF',
    type: '#FFCB6B',
    tag: '#F07178',
    attr: '#C3E88D',
    default: '#A6ACCD',
  },
};

const spacing: Spacing = {
  xs: 0, sm: 1, md: 2, lg: 3, xl: 4
};

const tokens = {
  elevation: {
    flat: 'rgba(0,0,0,0)',
    raised: 'rgba(0, 229, 192, 0.08)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    sticky: 'rgba(0, 229, 192, 0.15)',
  },
  radius: {
    sm: 0,
    md: 1,
    lg: 2,
    full: 0,
  },
  animation: {
    fast: 80,
    normal: 150,
    slow: 300,
    easing: 'ease-out',
  },
  semantic: {
    interactive: {
      idle: aegisColors.primary,
      hover: '#33ffd9',
      active: '#00bfa0',
      disabled: '#44405a',
    },
    focus: {
      ring: '#00e5c0',
      glow: 'rgba(0, 229, 192, 0.3)',
    },
    code: {
      background: '#08080f',
      border: '#1a1a2a',
    },
  },
};

export const aegisTheme: Theme = {
  name: 'aegis',
  colors: aegisColors,
  spacing,
  tokens,
};
