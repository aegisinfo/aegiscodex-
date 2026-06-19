/**
 *
 */
import { defaultTheme } from './defaultTheme.js';
const darkTokens = {
    elevation: {
        flat: 'rgba(0,0,0,0)',
        raised: 'rgba(96, 165, 250, 0.08)',
        overlay: 'rgba(0, 0, 0, 0.4)',
        sticky: 'rgba(96, 165, 250, 0.12)',
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
            idle: '#60a5fa',
            hover: '#93c5fd',
            active: '#3b82f6',
            disabled: '#9ca3af',
        },
        focus: {
            ring: '#60a5fa',
            glow: 'rgba(96, 165, 250, 0.3)',
        },
        code: {
            background: '#1f2937',
            border: '#374151',
        },
    },
};
export const darkTheme = {
    ...defaultTheme,
    name: 'dark',
    tokens: darkTokens,
    colors: {
        ...defaultTheme.colors,
        primary: '#60a5fa', // blue-400
        secondary: '#818cf8', // indigo-400
        accent: '#a78bfa', // violet-400
        success: '#34d399', // emerald-400
        warning: '#fbbf24', // amber-400
        error: '#f87171', // red-400
        info: '#22d3ee', // cyan-400
        text: {
            primary: '#f9fafb', // gray-50
            secondary: '#e5e7eb', // gray-200
            muted: '#9ca3af', // gray-400
            light: '#111827', // gray-900
        },
        background: {
            primary: '#111827', // gray-900
            secondary: '#1f2937', // gray-800
            dark: '#030712', // gray-950
        },
        border: {
            light: '#374151', // gray-700
            dark: '#1f2937', // gray-800
        },
        syntax: {
            comment: '#9ca3af', // gray-400
            string: '#34d399', // emerald-400
            number: '#f472b6', // pink-400
            keyword: '#a78bfa', // violet-400
            function: '#60a5fa', // blue-400
            variable: '#e5e7eb', // gray-200
            operator: '#fbbf24', // amber-400
            type: '#22d3ee', // cyan-400
            tag: '#fb7185', // rose-400
            attr: '#facc15', // yellow-400
            default: '#f9fafb', // gray-50
        },
    },
};
//# sourceMappingURL=darkTheme.js.map