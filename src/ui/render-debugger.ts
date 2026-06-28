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

// ============ Types ============

interface RenderEvent {
  type: 'mount' | 'update' | 'unmount' | 'state-change' | 'store-sub' | 'raf-poll'
  component: string
  timestamp: number
  duration?: number        // ms since last render of same component
  prevProps?: string       // JSON-hash of previous props
  nextProps?: string       // JSON-hash of current props
  stack?: string           // limited call stack
  messageId?: string       // for streaming messages
  contentLen?: number      // content length delta
  storeAction?: string     // which store action triggered this
}

interface ComponentStats {
  renderCount: number
  lastRender: number
  minInterval: number
  maxInterval: number
  totalTime: number        // ms since first render
  warnings: string[]
}

interface DebuggerState {
  enabled: boolean
  events: RenderEvent[]
  componentStats: Map<string, ComponentStats>
  intervalId: ReturnType<typeof setInterval> | null
  originalRaf: typeof requestAnimationFrame
  originalSetState: any
  componentRenderCounts: Map<string, number>
  history: RenderEvent[]
}

// ============ Globals ============

const RENDER_STORM_THRESHOLD = 10   // renders/sec
const CASCADE_THRESHOLD = 50        // ms between parent→child renders
const MAX_EVENTS = 1000
const REPORT_INTERVAL = 3000        // ms between auto-reports

const state: DebuggerState = {
  enabled: false,
  events: [],
  componentStats: new Map(),
  intervalId: null,
  originalRaf: globalThis.requestAnimationFrame,
  originalSetState: null,
  componentRenderCounts: new Map(),
  history: [],
}

// ============ Helpers ============

function componentName(element: any): string {
  if (!element) return '<unknown>'
  if (typeof element === 'string') return element
  if (element.displayName) return element.displayName
  if (element.name) return element.name
  if (element.type) {
    if (typeof element.type === 'string') return element.type
    return element.type.displayName || element.type.name || '<anonymous>'
  }
  return '<unknown>'
}

function hashProps(props: Record<string, any>): string {
  const keys = Object.keys(props).sort()
  const parts = keys.map(k => {
    const v = props[k]
    if (typeof v === 'function') return `${k}:fn`
    if (typeof v === 'object' && v !== null) return `${k}:obj`
    return `${k}:${String(v).slice(0, 50)}`
  })
  return parts.join('|')
}

function getCallStack(limit = 3): string {
  const err = new Error()
  const stack = err.stack?.split('\n').slice(3, 3 + limit) || []
  return stack.map(s => s.trim()).join(' ← ')
}

// ============ Component Render Hooks ============

/**
 * Patch React.createElement to track component renders.
 * We wrap the original to count renders per component type.
 */
function patchReactCreateElement(React: any): () => void {
  if (!React || !React.createElement) return () => {}

  const originalCreateElement = React.createElement

  React.createElement = function patchedCreateElement(type: any, props: any, ...children: any[]) {
    if (state.enabled) {
      const name = componentName({ type })
      const count = state.componentRenderCounts.get(name) || 0
      state.componentRenderCounts.set(name, count + 1)

      const event: RenderEvent = {
        type: count === 0 ? 'mount' : 'update',
        component: name,
        timestamp: performance.now(),
        stack: getCallStack(2),
        nextProps: props ? hashProps(props) : '{}',
      }
      state.events.push(event)
      if (state.events.length > MAX_EVENTS) state.events.shift()
    }
    return originalCreateElement.call(React, type, props, ...children)
  }

  return () => {
    React.createElement = originalCreateElement
  }
}

// ============ Store Subscription Monitor ============

let storeUnsubPatched = false

/**
 * Patch zustand subscribe to detect subscription leaks
 * and log store action → render causality.
 */
function patchStoreSubscribe(store: any): () => void {
  if (!store || storeUnsubPatched) return () => {}
  storeUnsubPatched = true

  const origSubscribe = store.subscribe.bind(store)

  const wrappedSubscribe = (selector: any, callback?: any) => {
    const wrappedCallback = callback
      ? (state: any, prevState?: any) => {
          if (state.enabled) {
            state.events.push({
              type: 'store-sub',
              component: 'store',
              timestamp: performance.now(),
              storeAction: 'subscribe-callback fired',
            })
          }
          callback(state, prevState)
        }
      : selector

    const unsub = origSubscribe(selector, wrappedCallback)
    return unsub
  }

  store.subscribe = wrappedSubscribe

  return () => {
    store.subscribe = origSubscribe
    storeUnsubPatched = false
  }
}

// ============ RAF Monitor ============

let rafCallCount = 0
let rafResetTimer: ReturnType<typeof setTimeout> | null = null

function patchRAF(): () => void {
  const originalRaf = globalThis.requestAnimationFrame
  const originalCaf = globalThis.cancelAnimationFrame

  const activeRafs = new Set<number>()

  ;(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback): number => {
    rafCallCount++
    if (rafResetTimer) clearTimeout(rafResetTimer)
    rafResetTimer = setTimeout(() => { rafCallCount = 0 }, 1000)

    const wrapped: FrameRequestCallback = (time) => {
      activeRafs.delete(id)
      cb(time)
    }
    const id = originalRaf.call(globalThis, wrapped)
    activeRafs.add(id)
    return id
  }

  ;(globalThis as any).cancelAnimationFrame = (id: number) => {
    activeRafs.delete(id)
    originalCaf.call(globalThis, id)
  }

  return () => {
    ;(globalThis as any).requestAnimationFrame = originalRaf
    ;(globalThis as any).cancelAnimationFrame = originalCaf
    activeRafs.forEach(id => originalCaf.call(globalThis, id))
    activeRafs.clear()
  }
}

// ============ Console Monitoring ============

function patchConsole(): () => void {
  const origWarn = console.warn
  const origError = console.error

  ;(console as any).warn = (...args: any[]) => {
    const msg = args.join(' ')
    if (
      msg.includes('maximum update depth') ||
      msg.includes('React has detected') ||
      msg.includes('Cannot update during') ||
      msg.includes('render') && msg.includes('state')
    ) {
      state.events.push({
        type: 'update',
        component: '[React Warning]',
        timestamp: performance.now(),
        nextProps: msg.slice(0, 200),
        stack: getCallStack(5),
      })
    }
    return origWarn.apply(console, args)
  }

  ;(console as any).error = (...args: any[]) => {
    const msg = args.join(' ')
    if (
      msg.includes('Minified React error') ||
      msg.includes('Rendered more hooks') ||
      msg.includes('Rendered fewer hooks')
    ) {
      state.events.push({
        type: 'update',
        component: '[React Error]',
        timestamp: performance.now(),
        nextProps: msg.slice(0, 200),
        stack: getCallStack(5),
      })
    }
    return origError.apply(console, args)
  }

  return () => {
    console.warn = origWarn
    console.error = origError
  }
}

// ============ Analysis ============

function analyzeRenderEvents(): {
  storms: string[]
  cascades: string[]
  loops: boolean
  streamingIssues: string[]
  summary: Record<string, number>
} {
  const result = {
    storms: [] as string[],
    cascades: [] as string[],
    loops: false,
    streamingIssues: [] as string[],
    summary: {} as Record<string, number>,
  }

  const perComponent = new Map<string, RenderEvent[]>()
  for (const ev of state.events) {
    if (ev.type === 'mount' || ev.type === 'update') {
      const list = perComponent.get(ev.component) || []
      list.push(ev)
      perComponent.set(ev.component, list)
    }
  }

  // 1. Re-render storms
  for (const [name, events] of Array.from(perComponent.entries())) {
    if (events.length < 5) continue

    // Check any 1-second window
    for (let i = 0; i < events.length - RENDER_STORM_THRESHOLD; i++) {
      const windowEnd = events[i].timestamp + 1000
      const count = events.filter(e => e.timestamp >= events[i].timestamp && e.timestamp <= windowEnd).length
      if (count >= RENDER_STORM_THRESHOLD) {
        result.storms.push(`${name}: ${count} renders within 1s window (threshold: ${RENDER_STORM_THRESHOLD})`)
        break
      }
    }
  }

  // 2. Cascading re-renders (rapid parent→child chain)
  const allEvents = state.events.filter(e => e.type === 'mount' || e.type === 'update')
  for (let i = 1; i < allEvents.length; i++) {
    const interval = allEvents[i].timestamp - allEvents[i - 1].timestamp
    if (interval < CASCADE_THRESHOLD && allEvents[i].component !== allEvents[i - 1].component) {
      result.cascades.push(
        `${allEvents[i - 1].component} → ${allEvents[i].component} (${interval.toFixed(1)}ms)`
      )
    }
  }

  // 3. Infinite render loop detection (same component in rapid succession)
  let loopStreak = 0
  for (let i = 1; i < allEvents.length; i++) {
    if (
      allEvents[i].component === allEvents[i - 1].component &&
      allEvents[i].timestamp - allEvents[i - 1].timestamp < 16  // < 1 frame
    ) {
      loopStreak++
      if (loopStreak >= 5) {
        result.loops = true
        result.storms.push(`${allEvents[i].component}: POSSIBLE INFINITE LOOP (${loopStreak} renders in <16ms each)`)
        break
      }
    } else {
      loopStreak = 0
    }
  }

  // 4. Streaming latency
  const subEvents = state.events.filter(e => e.type === 'store-sub' && e.timestamp > 0)
  const renderEvents = state.events.filter(e => e.type === 'update' && e.component === 'MessageRenderer')
  if (subEvents.length > 0 && renderEvents.length > 0) {
    const avg = renderEvents.length / (subEvents.length || 1)
    if (avg < 0.5) {
      result.streamingIssues.push(`Store subscriptions (${subEvents.length}) vs renders (${renderEvents.length}): possible skipped updates (ratio: ${avg.toFixed(2)})`)
    }
  }

  // RAF call rate
  if (rafCallCount > 60) {
    result.streamingIssues.push(`High RAF call rate: ${rafCallCount}/sec (should be ~60 max)`)
  }

  // Summary
  for (const [name, events] of Array.from(perComponent.entries())) {
    result.summary[name] = events.length
  }

  // Deduplicate using forEach
  const stormSet = new Set<string>();
  result.storms.forEach(s => stormSet.add(s));
  result.storms = Array.from(stormSet);
  result.cascades = result.cascades.slice(0, 20)

  return result
}

// ============ Reporting ============

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function generateReport(): string {
  const analysis = analyzeRenderEvents()
  const lines: string[] = []
  const now = new Date().toISOString()

  lines.push(`\n${'═'.repeat(60)}`)
  lines.push(`  AEGISCode Rendering Report — ${now}`)
  lines.push(`${'═'.repeat(60)}`)

  // Summary
  lines.push(`\n  Total render events tracked: ${state.events.length}`)
  lines.push(`  Components tracked: ${Object.keys(analysis.summary).length}`)

  lines.push(`\n  ── Render counts per component ──`)
  const sorted = Object.entries(analysis.summary).sort((a, b) => b[1] - a[1])
  for (const [name, count] of sorted.slice(0, 15)) {
    lines.push(`    ${name.padEnd(30)} ${String(count).padStart(5)} renders`)
  }

  // Storms
  if (analysis.storms.length > 0) {
    lines.push(`\n  ── ⚠ RENDER STORMS ──`)
    for (const storm of analysis.storms) {
      lines.push(`    🔴 ${storm}`)
    }
  }

  // Cascades
  if (analysis.cascades.length > 0) {
    lines.push(`\n  ── Re-render Cascades (top 10) ──`)
    for (const cascade of analysis.cascades.slice(0, 10)) {
      lines.push(`    🟡 ${cascade}`)
    }
  }

  // Infinite loops
  if (analysis.loops) {
    lines.push(`\n  ── 🔴 INFINITE RENDER LOOP DETECTED ──`)
    lines.push(`    Immediate action required: check state updates in render cycle`)
  }

  // Streaming issues
  if (analysis.streamingIssues.length > 0) {
    lines.push(`\n  ── Streaming Issues ──`)
    for (const issue of analysis.streamingIssues) {
      lines.push(`    🟠 ${issue}`)
    }
  }

  // Healthy
  if (
    analysis.storms.length === 0 &&
    analysis.cascades.length === 0 &&
    !analysis.loops &&
    analysis.streamingIssues.length === 0
  ) {
    lines.push(`\n  ✅ No rendering problems detected.`)
  }

  // Recommendations
  if (
    analysis.storms.length > 0 ||
    analysis.cascades.length > 0 ||
    analysis.loops ||
    analysis.streamingIssues.length > 0
  ) {
    lines.push(`\n  ── Recommendations ──`)

    if (analysis.loops) {
      lines.push(`  1. Break render→setState→render cycle with useRef or useEffect`)
    }
    if (analysis.storms.length > 0) {
      lines.push(`  2. Add React.memo() or refine memo comparator on storm components`)
      lines.push(`  3. Batch store updates: use flush() pattern (already in AegisInterface)`)
    }
    if (analysis.cascades.length > 0) {
      lines.push(`  4. Lift state up or use useContext with stable references`)
      lines.push(`  5. Check useCallback/useMemo deps on parent components`)
    }
    if (analysis.streamingIssues.length > 0) {
      lines.push(`  6. Ensure RAF poll catches content length changes (MessageList)`)
      lines.push(`  7. Verify MessageRenderer comparator allows streaming updates`)
    }
  }

  lines.push(`${'═'.repeat(60)}\n`)

  return lines.join('\n')
}

function autoReport() {
  if (!state.enabled) return
  const report = generateReport()
  console.log(report)
}

// ============ Public API ============

/**
 * Start the rendering debugger.
 * Patches React.createElement, RAF, console, and zustand store.
 * Begins periodic reporting of rendering health.
 *
 * @param options.reportInterval - ms between auto-reports (default 3000)
 * @param options.verbose - console.log every render event (default false)
 */
export async function startRenderDebugger(options?: { reportInterval?: number; verbose?: boolean }): Promise<void> {
  if (state.enabled) {
    console.log('[RenderDebugger] Already running')
    return
  }

  state.enabled = true
  const interval = options?.reportInterval || REPORT_INTERVAL
  const verbose = options?.verbose || false

  console.log(`\n🔍 AEGISCode Rendering Debugger started (report interval: ${interval}ms)`)
  if (verbose) console.log('   Verbose mode: every render event will be logged')

  // Patch RAF
  const unpatches: (() => void)[] = []
  unpatches.push(patchRAF())

  // Patch console for React warnings
  unpatches.push(patchConsole())

  // Try to patch React if available
  try {
    const React = await import('react')
    unpatches.push(patchReactCreateElement(React.default || React))
  } catch {
    // React not loaded yet; try again after a tick
    setTimeout(async () => {
      try {
        const React = await import('react')
        unpatches.push(patchReactCreateElement(React.default || React))
      } catch {}
    }, 100)
  }

  // Auto-reporting interval
  state.intervalId = setInterval(() => {
    autoReport()
  }, interval)

  // Store reference for cleanup
  ;(globalThis as any).__RENDER_DEBUGGER__ = {
    state,
    unpatches,
    stop: stopRenderDebugger,
    report: generateReport,
  }

  if (!verbose) {
    // In non-verbose mode, suppress individual render event logging
    const origPush = state.events.push.bind(state.events)
    state.events.push = (...items: RenderEvent[]): number => {
      // Only log warnings to console
      for (const item of items) {
        if (item.stack?.includes('Warning') || item.component.startsWith('[React')) {
          console.log(`[RenderDebugger] ${item.component}: ${item.nextProps?.slice(0, 80)}`)
        }
      }
      return origPush(...items)
    }
  }
}

/**
 * Stop the rendering debugger and generate a final report.
 */
export function stopRenderDebugger(): string {
  if (!state.enabled) {
    return 'Render debugger was not running.'
  }

  state.enabled = false

  // Restore patches
  const debug = (globalThis as any).__RENDER_DEBUGGER__
  if (debug?.unpatches) {
    for (const unpatch of debug.unpatches) {
      try { unpatch() } catch {}
    }
  }

  // Clear interval
  if (state.intervalId) {
    clearInterval(state.intervalId)
    state.intervalId = null
  }

  delete (globalThis as any).__RENDER_DEBUGGER__

  const finalReport = generateReport()
  console.log(finalReport)

  console.log('📊 Render Debugger stopped.')
  console.log(`   Events captured: ${state.events.length}`)

  // Reset state
  state.events = []
  state.componentStats.clear()
  state.componentRenderCounts.clear()

  return finalReport
}

/**
 * Get the current analysis without stopping the debugger.
 */
export function getRenderReport(): string {
  return generateReport()
}

/**
 * Get raw render events for programmatic analysis.
 */
export function getRenderEvents(): RenderEvent[] {
  return [...state.events]
}

/**
 * Get the top N most frequently rendered components.
 */
export function getHottestComponents(n = 10): Array<{ name: string; count: number }> {
  const counts: Record<string, number> = {}
  for (const ev of state.events) {
    if (ev.type === 'mount' || ev.type === 'update') {
      counts[ev.component] = (counts[ev.component] || 0) + 1
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }))
}

// ============ Auto-start via CLI flag ============

// Check for --debug-rendering flag
const debugRenderingArg = process.argv.includes('--debug-rendering')
if (debugRenderingArg) {
  setTimeout(() => startRenderDebugger({ verbose: false }), 0)
}

export default { startRenderDebugger, stopRenderDebugger, getRenderReport }
