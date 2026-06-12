/**
 * useTerminalWidth - Terminal width hook with RAF debounce to prevent render storms
 */
/**
 * Returns terminal width, updated with requestAnimationFrame debounce on resize
 * @returns number Terminal width in columns
 */
export declare const useTerminalWidth: () => number;
/**
 * useTerminalHeight - Terminal height hook with RAF debounce
 * @returns number Terminal height in rows
 */
export declare const useTerminalHeight: () => number;
/**
 * useTerminalSize - Combined terminal size hook
 */
export declare const useTerminalSize: () => {
    width: number;
    height: number;
};
//# sourceMappingURL=useTerminalWidth.d.ts.map