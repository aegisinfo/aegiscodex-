/**
 * useTerminalWidth - Terminal width hook with RAF debounce to prevent render storms
 */

import { useState, useEffect, useRef } from 'react';

/**
 * Returns terminal width, updated with requestAnimationFrame debounce on resize
 * @returns number Terminal width in columns
 */
export const useTerminalWidth = (): number => {
  const [width, setWidth] = useState(process.stdout.columns || 80);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        setWidth(process.stdout.columns || 80);
        rafRef.current = null;
      });
    };

    process.stdout.on('resize', handleResize);

    return () => {
      process.stdout.off('resize', handleResize);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return width;
};

/**
 * useTerminalHeight - Terminal height hook with RAF debounce
 * @returns number Terminal height in rows
 */
export const useTerminalHeight = (): number => {
  const [height, setHeight] = useState(process.stdout.rows || 24);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        setHeight(process.stdout.rows || 24);
        rafRef.current = null;
      });
    };

    process.stdout.on('resize', handleResize);

    return () => {
      process.stdout.off('resize', handleResize);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return height;
};

/**
 * useTerminalSize - Combined terminal size hook
 */
export const useTerminalSize = (): { width: number; height: number } => {
  const width = useTerminalWidth();
  const height = useTerminalHeight();
  return { width, height };
};
