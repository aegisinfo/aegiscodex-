import type { Theme, BaseColors, Spacing } from './types.js';

const aegisColors: BaseColors = {
  primary: '#00e5c0',      // ÆGIS teal
  secondary: '#7c6fd4',    // purple
  accent: '#00e5c0',
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
    secondary: '#08080f',
    dark: '#0c0c16',
  },
  border: {
    light: '#1a1a2a',
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

const spacing: Spacing = { xs: 0, sm: 1, md: 2, lg: 3, xl: 4 };

export const defaultTheme: Theme = {
  name: 'default',
  colors: aegisColors,
  spacing
};
