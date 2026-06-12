/**
 * AEGISCode Rendering Debugger
 *
 * Injects probes into the rendering pipeline to detect:
 *  1. Re-render storms (>10 renders/sec on any component)
 *  2. Cascading re-renders (parent triggers child unnecessarily)
 *  3. Stale closures / missing deps (state change without re-render)
 *  4. Infinite render loops (render → state → render without RAF break)
 *  5. Streaming render latency (time between store flush and DOM update)
 *  6. Memo comparator regressions (skipped re-render when content changed)
 *  7. Zustand subscription leaks (subscriptions not cleaned up)
 *
 * Usage:
 *   import { startRenderDebugger, stopRenderDebugger } from './render-debugger.js'
 *   startRenderDebugger()
 *
 * Or via CLI:
 *   aegis --debug-rendering
 */
interface RenderEvent {
    type: 'mount' | 'update' | 'unmount' | 'state-change' | 'store-sub' | 'raf-poll';
    component: string;
    timestamp: number;
    duration?: number;
    prevProps?: string;
    nextProps?: string;
    stack?: string;
    messageId?: string;
    contentLen?: number;
    storeAction?: string;
}
/**
 * Start the rendering debugger.
 * Patches React.createElement, RAF, console, and zustand store.
 * Begins periodic reporting of rendering health.
 *
 * @param options.reportInterval - ms between auto-reports (default 3000)
 * @param options.verbose - console.log every render event (default false)
 */
export declare function startRenderDebugger(options?: {
    reportInterval?: number;
    verbose?: boolean;
}): Promise<void>;
/**
 * Stop the rendering debugger and generate a final report.
 */
export declare function stopRenderDebugger(): string;
/**
 * Get the current analysis without stopping the debugger.
 */
export declare function getRenderReport(): string;
/**
 * Get raw render events for programmatic analysis.
 */
export declare function getRenderEvents(): RenderEvent[];
/**
 * Get the top N most frequently rendered components.
 */
export declare function getHottestComponents(n?: number): Array<{
    name: string;
    count: number;
}>;
declare const _default: {
    startRenderDebugger: typeof startRenderDebugger;
    stopRenderDebugger: typeof stopRenderDebugger;
    getRenderReport: typeof getRenderReport;
};
export default _default;
//# sourceMappingURL=render-debugger.d.ts.map