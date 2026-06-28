/**
 * Pricing database — per-model costs in $/1M tokens (input, output).
 *
 * These are the raw provider costs before the AEGIS margin is applied.
 * Auto-router uses cheapest-first ordering; billing uses actual token
 * counts from each API call to compute the dollar cost and the 3× margin.
 */
export type ModelCost = { input: number; output: number };

/**
 * Price table keyed by model-id (the id field in config/models[]).
 * Falls back to partial name matching, then to a sensible default.
 */
const MODEL_COST_TABLE: Record<string, ModelCost> = {
  // ── Anthropic ──
  'claude-opus-4':      { input: 15,   output: 75   },
  'claude-sonnet-4':    { input: 3,    output: 15   },
  'claude-haiku-4':     { input: 0.8,  output: 4    },
  'claude-fable-5':     { input: 5,    output: 25   },

  // ── OpenAI ──
  'openai-gpt-4o':      { input: 2.5,  output: 10   },
  'openai-o3':          { input: 10,   output: 40   },
  'openai-gpt-5.5':     { input: 10,   output: 40   },
  'chatgpt':            { input: 2.5,  output: 10   },

  // ── DeepSeek ──
  'deepseek-chat':      { input: 0.14, output: 0.28 },
  'deepseek-reasoner':  { input: 0.55, output: 2.19 },

  // ── Groq ──
  'groq-llama':         { input: 0.06, output: 0.06 },
  'groq-deepseek':      { input: 0.06, output: 0.06 },

  // ── Google ──
  'gemini-2.5-pro':     { input: 1.25, output: 10   },
  'gemini-2.5-flash':   { input: 0.15, output: 0.60 },

  // ── Local ──
  'ollama-local':       { input: 0,    output: 0    },
};

/**
 * Look up a model's raw provider cost by its model-id.
 * Falls back to partial name matching when no exact key exists.
 * Returns a sensible default ($1/$3 per MTok) when unknown.
 */
export function costForModel(modelIdOrName: string): ModelCost {
  const exact = MODEL_COST_TABLE[modelIdOrName];
  if (exact) return exact;

  const key = modelIdOrName.toLowerCase();
  for (const [id, cost] of Object.entries(MODEL_COST_TABLE)) {
    if (key.includes(id) || id.includes(key)) return cost;
  }
  return { input: 1, output: 3 }; // fallback
}

/**
 * Compute the raw dollar cost for a single API call.
 *
 * @param modelId  Model identifier (used for price lookup)
 * @param promptTokens  Tokens in the prompt/input
 * @param completionTokens  Tokens in the completion/output
 * @returns  Raw provider cost in dollars
 */
export function computeRawCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const { input, output } = costForModel(modelId);
  return (promptTokens * input + completionTokens * output) / 1_000_000;
}

/** Margin multiplier applied to raw provider cost. */
export const MARGIN_MULTIPLIER = 3;

/**
 * Compute the billed (user-facing) cost including the AEGIS margin.
 * Billed cost = raw cost × MARGIN_MULTIPLIER.
 * The difference (billed − raw) is the AEGIS margin.
 */
export function computeBilledCost(rawCost: number): number {
  return rawCost * MARGIN_MULTIPLIER;
}

/**
 * Convenience — returns both raw and billed cost in one call.
 *
 * @returns  { rawCost, billedCost, marginAmount }
 */
export function computeCosts(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): { rawCost: number; billedCost: number; marginAmount: number } {
  const rawCost = computeRawCost(modelId, promptTokens, completionTokens);
  const billedCost = computeBilledCost(rawCost);
  return {
    rawCost,
    billedCost,
    marginAmount: billedCost - rawCost,
  };
}

/** Format a dollar value to a readable string (short, no trailing zeros). */
export function formatCost(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.00001) return '<$0.00001';
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  if (usd < 100) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
