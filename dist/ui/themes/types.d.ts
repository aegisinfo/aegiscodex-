/**
 *
 */
/**
 *
 */
export type ColorMode = 'dark' | 'light' | 'unknown';
/**
 *
 */
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
/**
 *
 */
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
/**
 *
 */
export interface Spacing {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
}
/**
 *
 */
export interface Theme {
    name: string;
    colors: BaseColors;
    spacing: Spacing;
}
/**
 *
 */
export interface RoleStyle {
    color: string;
    prefix: string;
    bold?: boolean;
}
/**
 *
 */
export interface ThemePreset {
    id: string;
    name: string;
    description?: string;
    theme: Theme;
}
//# sourceMappingURL=types.d.ts.map