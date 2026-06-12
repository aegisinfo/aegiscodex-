/**
 * Popular themes: Dracula, Nord, Tokyo Night, Catppuccin
 */
const defaultSpacing = { xs: 0, sm: 1, md: 2, lg: 3, xl: 4 };
// ─── Dracula ───────────────────────────────────────────────
const draculaColors = {
    primary: '#bd93f9', // purple
    secondary: '#ff79c6', // pink
    accent: '#50fa7b', // green
    success: '#50fa7b',
    warning: '#f1fa8c',
    error: '#ff5555',
    info: '#8be9fd',
    text: {
        primary: '#f8f8f2',
        secondary: '#e9e9f0',
        muted: '#6272a4',
        light: '#f8f8f2',
    },
    background: {
        primary: '#282a36',
        secondary: '#44475a',
        dark: '#21222c',
    },
    border: {
        light: '#44475a',
        dark: '#21222c',
    },
    syntax: {
        keyword: '#ff79c6',
        string: '#f1fa8c',
        number: '#bd93f9',
        comment: '#6272a4',
        function: '#50fa7b',
        variable: '#f8f8f2',
        operator: '#ff79c6',
        type: '#8be9fd',
        tag: '#ff5555',
        attr: '#50fa7b',
        default: '#f8f8f2',
    },
};
export const draculaTheme = {
    name: 'dracula',
    colors: draculaColors,
    spacing: defaultSpacing,
};
// ─── Nord ──────────────────────────────────────────────────
const nordColors = {
    primary: '#88c0d0', // frost
    secondary: '#81a1c1', // frost
    accent: '#a3be8c', // green
    success: '#a3be8c',
    warning: '#ebcb8b',
    error: '#bf616a',
    info: '#88c0d0',
    text: {
        primary: '#eceff4',
        secondary: '#e5e9f0',
        muted: '#616e88',
        light: '#eceff4',
    },
    background: {
        primary: '#2e3440',
        secondary: '#3b4252',
        dark: '#242933',
    },
    border: {
        light: '#4c566a',
        dark: '#2e3440',
    },
    syntax: {
        keyword: '#81a1c1',
        string: '#a3be8c',
        number: '#b48ead',
        comment: '#616e88',
        function: '#88c0d0',
        variable: '#d8dee9',
        operator: '#81a1c1',
        type: '#8fbcbb',
        tag: '#bf616a',
        attr: '#a3be8c',
        default: '#eceff4',
    },
};
export const nordTheme = {
    name: 'nord',
    colors: nordColors,
    spacing: defaultSpacing,
};
// ─── Tokyo Night ───────────────────────────────────────────
const tokyoNightColors = {
    primary: '#7aa2f7', // blue
    secondary: '#bb9af7', // purple
    accent: '#7dcfff', // cyan
    success: '#9ece6a',
    warning: '#e0af68',
    error: '#f7768e',
    info: '#7dcfff',
    text: {
        primary: '#c0caf5',
        secondary: '#a9b1d6',
        muted: '#565f89',
        light: '#c0caf5',
    },
    background: {
        primary: '#1a1b26',
        secondary: '#24283b',
        dark: '#0f0f17',
    },
    border: {
        light: '#3b4261',
        dark: '#1a1b26',
    },
    syntax: {
        keyword: '#bb9af7',
        string: '#9ece6a',
        number: '#ff9e64',
        comment: '#565f89',
        function: '#7aa2f7',
        variable: '#c0caf5',
        operator: '#89DDFF',
        type: '#ff9e64',
        tag: '#f7768e',
        attr: '#9ece6a',
        default: '#c0caf5',
    },
};
export const tokyoNightTheme = {
    name: 'tokyo-night',
    colors: tokyoNightColors,
    spacing: defaultSpacing,
};
// ─── Catppuccin Mocha ──────────────────────────────────────
const catppuccinColors = {
    primary: '#89b4fa', // blue
    secondary: '#cba6f7', // mauve
    accent: '#a6e3a1', // green
    success: '#a6e3a1',
    warning: '#f9e2af',
    error: '#f38ba8',
    info: '#89dceb',
    text: {
        primary: '#cdd6f4',
        secondary: '#bac2de',
        muted: '#6c7086',
        light: '#cdd6f4',
    },
    background: {
        primary: '#1e1e2e',
        secondary: '#313244',
        dark: '#181825',
    },
    border: {
        light: '#45475a',
        dark: '#1e1e2e',
    },
    syntax: {
        keyword: '#cba6f7',
        string: '#a6e3a1',
        number: '#fab387',
        comment: '#6c7086',
        function: '#89b4fa',
        variable: '#cdd6f4',
        operator: '#89dceb',
        type: '#f9e2af',
        tag: '#f38ba8',
        attr: '#a6e3a1',
        default: '#cdd6f4',
    },
};
export const catppuccinTheme = {
    name: 'catppuccin',
    colors: catppuccinColors,
    spacing: defaultSpacing,
};
//# sourceMappingURL=popularThemes.js.map