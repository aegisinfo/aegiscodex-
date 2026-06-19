/**
 * useTerminalSize - Combined terminal size hook with RAF debounce + resize observer
 *
 * Consolidates useTerminalWidth and useTerminalHeight into a single hook
 * to avoid duplicate RAF loops and ensure width/height are always in sync.
 */
interface TerminalSize {
    width: number;
    height: number;
}
export declare function useTerminalSize(): TerminalSize;
export declare const useTerminalWidth: () => number;
export declare const useTerminalHeight: () => number;
export {};
//# sourceMappingURL=useTerminalSize.d.ts.map