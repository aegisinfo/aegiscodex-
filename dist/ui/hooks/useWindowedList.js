/**
 * useWindowedList - Virtual list rendering hook for Ink
 *
 * Only renders items within the visible window, drastically reducing
 * render cost for long message lists.
 *
 * Uses a fixed item height estimate for simplicity. Ink doesn't give us
 * actual item heights, so we estimate based on content length.
 */
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
const ESTIMATED_ITEM_HEIGHT = 3; // rows per message average
const OVERSCAN = 3; // extra items above/below viewport
function calcVisibleCount(terminalHeight) {
    const visibleHeight = Math.max(terminalHeight - 5, 5);
    return Math.ceil(visibleHeight / ESTIMATED_ITEM_HEIGHT) + OVERSCAN * 2;
}
export function useWindowedList(items, terminalHeight) {
    const visibleCount = calcVisibleCount(terminalHeight);
    const [scrollIndex, setScrollIndex] = useState(() => Math.max(0, items.length - visibleCount));
    const prevLenRef = useRef(items.length);
    const isAtBottomRef = useRef(true);
    // Track latest items length via ref to avoid callback recreations
    const itemsLenRef = useRef(items.length);
    itemsLenRef.current = items.length;
    // Auto-scroll to bottom when new items arrive (if already at bottom)
    useEffect(() => {
        const prevLen = prevLenRef.current;
        const currentLen = items.length;
        if (currentLen > prevLen && isAtBottomRef.current) {
            setScrollIndex(Math.max(0, currentLen - visibleCount));
        }
        prevLenRef.current = currentLen;
    }, [items.length, visibleCount]);
    const [committedScrollIndex, setCommittedScrollIndex] = useState(scrollIndex);
    const isAtBottom = useMemo(() => committedScrollIndex + visibleCount >= items.length, [committedScrollIndex, visibleCount, items.length]);
    const scrollTo = useCallback((index) => {
        const len = itemsLenRef.current;
        const vCount = calcVisibleCount(terminalHeight);
        const clamped = Math.max(0, Math.min(index, len - 1));
        setScrollIndex(clamped);
        setCommittedScrollIndex(clamped);
        isAtBottomRef.current = clamped + vCount >= len;
    }, [terminalHeight]);
    const scrollToBottom = useCallback(() => {
        const len = itemsLenRef.current;
        const vCount = calcVisibleCount(terminalHeight);
        const bottom = Math.max(0, len - vCount);
        setScrollIndex(bottom);
        setCommittedScrollIndex(bottom);
        isAtBottomRef.current = true;
    }, [terminalHeight]);
    // Compute visible window
    const startIndex = Math.max(0, committedScrollIndex - OVERSCAN);
    const endIndex = Math.min(items.length, committedScrollIndex + visibleCount + OVERSCAN);
    const visibleItems = useMemo(() => items.slice(startIndex, endIndex).map((item, i) => ({
        item,
        index: startIndex + i,
    })), [items, startIndex, endIndex]);
    const topPadding = startIndex * ESTIMATED_ITEM_HEIGHT;
    const bottomPadding = (items.length - endIndex) * ESTIMATED_ITEM_HEIGHT;
    const containerRef = useRef(null);
    return {
        visibleItems,
        totalItems: items.length,
        topPadding,
        bottomPadding,
        scrollTo,
        scrollToBottom,
        isAtBottom,
        containerRef,
    }; // Type cast for Ink compatibility
}
//# sourceMappingURL=useWindowedList.js.map