/**
 * useWindowedList - Virtual list rendering hook for Ink
 *
 * Only renders items within the visible window, drastically reducing
 * render cost for long message lists.
 *
 * Uses a fixed item height estimate for simplicity. Ink doesn't give us
 * actual item heights, so we estimate based on content length.
 */

import { useState, useRef, useCallback, useMemo } from 'react';

interface WindowedListResult<T> {
  /** The subset of items to render */
  visibleItems: Array<{ item: T; index: number }>;
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

const ESTIMATED_ITEM_HEIGHT = 3; // rows per message average
const OVERSCAN = 3; // extra items above/below viewport

export function useWindowedList<T>(
  items: T[],
  terminalHeight: number,
): WindowedListResult<T> {
  const visibleHeight = Math.max(terminalHeight - 5, 5); // account for header/input
  const visibleCount = Math.ceil(visibleHeight / ESTIMATED_ITEM_HEIGHT) + OVERSCAN * 2;

  const [scrollIndex, setScrollIndex] = useState<number>(() =>
    Math.max(0, items.length - visibleCount),
  );
  const prevLenRef = useRef(items.length);
  const isAtBottomRef = useRef(true);

  // Auto-scroll to bottom when new items arrive (if already at bottom)
  if (items.length > prevLenRef.current && isAtBottomRef.current) {
    // Don't set state during render; use a ref update pattern
    prevLenRef.current = items.length;
  }

  const [committedScrollIndex, setCommittedScrollIndex] = useState(scrollIndex);

  const isAtBottom = useMemo(
    () => committedScrollIndex + visibleCount >= items.length,
    [committedScrollIndex, visibleCount, items.length],
  );

  const scrollTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    setScrollIndex(clamped);
    setCommittedScrollIndex(clamped);
    isAtBottomRef.current = clamped + visibleCount >= items.length;
  }, [items.length, visibleCount]);

  const scrollToBottom = useCallback(() => {
    const bottom = Math.max(0, items.length - visibleCount);
    setScrollIndex(bottom);
    setCommittedScrollIndex(bottom);
    isAtBottomRef.current = true;
  }, [items.length, visibleCount]);

  // Compute visible window
  const startIndex = Math.max(0, committedScrollIndex - OVERSCAN);
  const endIndex = Math.min(items.length, committedScrollIndex + visibleCount + OVERSCAN);

  const visibleItems = useMemo(
    () => items.slice(startIndex, endIndex).map((item, i) => ({
      item,
      index: startIndex + i,
    })),
    [items, startIndex, endIndex],
  );

  const topPadding = startIndex * ESTIMATED_ITEM_HEIGHT;
  const bottomPadding = (items.length - endIndex) * ESTIMATED_ITEM_HEIGHT;

  const containerRef = useRef<HTMLDivElement | null>(null);

  return {
    visibleItems,
    totalItems: items.length,
    topPadding,
    bottomPadding,
    scrollTo,
    scrollToBottom,
    isAtBottom,
    containerRef,
  } as any; // Type cast for Ink compatibility
}
