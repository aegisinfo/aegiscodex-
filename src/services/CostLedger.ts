/**
 * CostLedger — per-session cost tracking and admin-panel reporting.
 *
 * Records every LLM call's raw cost, billed cost (×3 margin), and the
 * margin amount, then periodically pushes a summary to the admin panel's
 * /api/billing endpoint so the dashboard shows real-time revenue data.
 *
 * Fire-and-forget: never blocks the agent loop.
 */

import * as https from 'node:https';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { computeCosts } from '../agent/pricing.js';

// ── Types ──

export interface CostEntry {
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  rawCost: number;
  billedCost: number;
  marginAmount: number;
  timestamp: number;
  sessionId?: string;
}

interface CostSnapshot {
  totalRawCost: number;
  totalBilledCost: number;
  totalMargin: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  sessionCount: number;
  modelBreakdown: Record<string, {
    calls: number;
    rawCost: number;
    billedCost: number;
    marginAmount: number;
  }>;
}

// ── State ──

/** In-memory cost entries for this process lifetime. */
const entries: CostEntry[] = [];

/** Interval handle for periodic flush. */
let flushHandle: ReturnType<typeof setInterval> | null = null;

// ── Helpers ──

function getApiKey(): string | null {
  try {
    const cfgPath = path.join(os.homedir(), '.aegiscode', 'config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return cfg?.aegiscloud?.api_key ?? null;
  } catch {
    return null;
  }
}

// ── API ──

/**
 * Record a single LLM call's token usage and compute costs.
 * Safe to call from anywhere — fire-and-forget, never throws.
 */
export function recordCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
  sessionId?: string,
): void {
  if (promptTokens <= 0 && completionTokens <= 0) return;

  // Trust the pricing.ts key matching (partial name fallback)
  const { rawCost, billedCost, marginAmount } = computeCosts(
    modelId,
    promptTokens,
    completionTokens,
  );

  entries.push({
    modelId,
    promptTokens,
    completionTokens,
    rawCost,
    billedCost,
    marginAmount,
    timestamp: Date.now(),
    sessionId,
  });
}

/**
 * Build a snapshot of all costs recorded so far.
 */
export function getCostSnapshot(): CostSnapshot {
  const snapshot: CostSnapshot = {
    totalRawCost: 0,
    totalBilledCost: 0,
    totalMargin: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    sessionCount: new Set(entries.map(e => e.sessionId).filter(Boolean)).size,
    modelBreakdown: {},
  };

  for (const e of entries) {
    snapshot.totalRawCost += e.rawCost;
    snapshot.totalBilledCost += e.billedCost;
    snapshot.totalMargin += e.marginAmount;
    snapshot.totalPromptTokens += e.promptTokens;
    snapshot.totalCompletionTokens += e.completionTokens;

    const b = snapshot.modelBreakdown[e.modelId] || (
      snapshot.modelBreakdown[e.modelId] = { calls: 0, rawCost: 0, billedCost: 0, marginAmount: 0 }
    );
    b.calls += 1;
    b.rawCost += e.rawCost;
    b.billedCost += e.billedCost;
    b.marginAmount += e.marginAmount;
  }

  return snapshot;
}

/**
 * Send a billing report to the admin panel.
 * Fire-and-forget — silently swallows all errors.
 */
function flushBillingReport(): void {
  const apiKey = getApiKey();
  if (!apiKey || entries.length === 0) return;

  // Take a snapshot and drain
  const snapshot = getCostSnapshot();
  const batch = entries.splice(0);

  const payload = JSON.stringify({
    ts: Date.now(),
    entries: batch.map(e => ({
      model_id: e.modelId,
      prompt_tokens: e.promptTokens,
      completion_tokens: e.completionTokens,
      raw_cost: e.rawCost,
      billed_cost: e.billedCost,
      margin: e.marginAmount,
      session_id: e.sessionId,
    })),
    totals: {
      raw_cost: snapshot.totalRawCost,
      billed_cost: snapshot.totalBilledCost,
      margin: snapshot.totalMargin,
    },
  });

  const req = https.request(
    {
      hostname: 'aegiscloud.org',
      path: '/api/billing',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'Content-Length': Buffer.byteLength(payload),
      },
    },
    (res) => { res.resume(); },
  );

  req.on('error', () => { /* silent */ });
  req.setTimeout(5000, () => { req.destroy(); });
  req.write(payload);
  req.end();
}

/**
 * Start the periodic billing flush timer.
 * Safe to call multiple times — only starts once.
 * Automatically flushes remaining entries on process exit.
 */
export function startCostLedger(): void {
  if (flushHandle) return;

  // Flush every 2 minutes (matches heartbeat interval)
  flushHandle = setInterval(flushBillingReport, 2 * 60 * 1000);
  if (typeof flushHandle === 'object' && 'unref' in flushHandle) {
    flushHandle.unref();
  }

  // Flush remaining entries on exit
  process.once('beforeExit', () => {
    flushBillingReport();
  });
}

/**
 * Stop the periodic flusher.
 */
export function stopCostLedger(): void {
  if (flushHandle) {
    clearInterval(flushHandle);
    flushHandle = null;
  }
  // Final flush
  flushBillingReport();
}
