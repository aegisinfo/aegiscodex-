/**
 *
 *
 */
import { defaultTheme } from './defaultTheme.js';
const lightTokens = {
    elevation: {
        flat: 'rgba(0,0,0,0)',
        raised: 'rgba(37, 99, 235, 0.06)',
        overlay: 'rgba(0, 0, 0, 0.15)',
        sticky: 'rgba(37, 99, 235, 0.1)',
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
            idle: '#2563eb',
            hover: '#1d4ed8',
            active: '#1e40af',
            disabled: '#9ca3af',
        },
        focus: {
            ring: '#2563eb',
            glow: 'rgba(37, 99, 235, 0.25)',
        },
        code: {
            background: '#f9fafb',
            border: '#d1d5db',
        },
    },
};
export const lightTheme = {
    ...defaultTheme,
    name: 'light',
    tokens: lightTokens,
    colors: {
        ...defaultTheme.colors,
        // 使用更深的颜色确保对比
        primary: '#2563eb', // blue-600
        secondary: '#4f46e5', // indigo-600
        accent: '#7c3aed', // violet-600
        success: '#16a34a', // green-600
        warning: '#d97706', // amber-600
        error: '#dc2626', // red-600
        info: '#0891b2', // cyan-600
        text: {
            primary: '#111827', // gray-900 - 最深的文
            secondary: '#374151', // gray-700
            muted: '#6b7280', // gray-500
            light: '#f9fafb', // gray-50
        },
        background: {
            primary: '#ffffff',
            secondary: '#f9fafb', // gray-50
            dark: '#111827', // gray-900
        },
        border: {
            light: '#d1d5db', // gray-300
            dark: '#6b7280', // gray-500
        },
        syntax: {
            comment: '#6b7280', // gray-500
            string: '#047857', // emerald-700
            number: '#be185d', // pink-700
            keyword: '#6d28d9', // violet-700
            function: '#1d4ed8', // blue-700
            variable: '#111827', // gray-900
            operator: '#b45309', // amber-700
            type: '#0e7490', // cyan-700
            tag: '#b91c1c', // red-700
            attr: '#a16207', // yellow-700
            default: '#111827', // gray-900
        },
    },
};
//# sourceMappingURL=lightTheme.js.map