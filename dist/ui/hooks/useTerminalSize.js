/**
 * useTerminalSize - Combined terminal size hook with RAF debounce + resize observer
 *
 * Consolidates useTerminalWidth and useTerminalHeight into a single hook
 * to avoid duplicate RAF loops and ensure width/height are always in sync.
 */
import { useState, useEffect, useRef } from 'react';
function getSize() {
    return {
        width: process.stdout.columns || 80,
        height: process.stdout.rows || 24,
    };
}
const DEBOUNCE_MS = 80; // Wait 80ms after last resize event before updating
export function useTerminalSize() {
    const [size, setSize] = useState(getSize);
    const rafRef = useRef(null);
    const debounceTimerRef = useRef(null);
    const sizeRef = useRef(size);
    sizeRef.current = size;
    useEffect(() => {
        const handleResize = () => {
            // RAF-throttle: skip if a frame is already queued
            if (rafRef.current !== null)
                return;
            // Debounce: restart timer on each resize event
            if (debounceTimerRef.current !== null) {
                clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(() => {
                rafRef.current = requestAnimationFrame(() => {
                    const newSize = getSize();
                    const prev = sizeRef.current;
                    // Only update if either dimension changed
                    if (newSize.width !== prev.width || newSize.height !== prev.height) {
                        setSize(newSize);
                    }
                    rafRef.current = null;
                });
                debounceTimerRef.current = null;
            }, DEBOUNCE_MS);
        };
        process.stdout.on('resize', handleResize);
        return () => {
            process.stdout.off('resize', handleResize);
            if (rafRef.current !== null)
                cancelAnimationFrame(rafRef.current);
            if (debounceTimerRef.current !== null)
                clearTimeout(debounceTimerRef.current);
        };
    }, []);
    return size;
}
// Re-export individual hooks for backward compatibility
export const useTerminalWidth = () => useTerminalSize().width;
export const useTerminalHeight = () => useTerminalSize().height;
//# sourceMappingURL=useTerminalSize.js.map