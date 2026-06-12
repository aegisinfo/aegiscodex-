/**
 * useWindowedList - Virtual list rendering hook for Ink
 *
 * Only renders items within the visible window, drastically reducing
 * render cost for long message lists.
 *
 * Uses a fixed item height estimate for simplicity. Ink doesn't give us
 * actual item heights, so we estimate based on content length.
 */
interface WindowedListResult<T> {
    /** The subset of items to render */
    visibleItems: Array<{
        item: T;
        index: number;
    }>;
    /** Total number of items */
    totalItems: number;
    /** Render padding at top to maintain scroll position */
    topPadding: number;
    /** Render padding at bottom */
    bottomPadding: number;
    /** Call when user scrolls up/down */
    scrollTo: (index: number) => void;
    /** Scroll to bottom (latest messages) */
    scrollToBottom: () => void;
    /** Whether we're pinned to bottom */
    isAtBottom: boolean;
    /** Ref to attach to scroll container */
    containerRef: React.RefObject<HTMLDivElement | null>;
}
export declare function useWindowedList<T>(items: T[], terminalHeight: number): WindowedListResult<T>;
export {};
//# sourceMappingURL=useWindowedList.d.ts.map