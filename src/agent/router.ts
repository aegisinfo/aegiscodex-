/**
 * Auto-router — classifies a task's complexity with cheap heuristics (no LLM
 * call) and resolves which configured model should handle it, so a quick
 * lookup doesn't pay for an expensive model and a hard refactor doesn't get
 * shortchanged by a weak one.
 */

import type { ModelConfig } from '../config/types.js';

export type ComplexityTier = 'simple' | 'medium' | 'complex';

const COMPLEX_KEYWORDS = [
  'architecture', 'refactor', 'security', 'design', 'rewrite', 'migrate',
  'migration', 'performance', 'race condition', 'concurrency', 'scalability',
  'vulnerability', 'audit', 'distributed', 'consensus', 'deadlock',
];

const SIMPLE_LEAD_WORDS = new Set([
  'what', 'why', 'how', 'when', 'where', 'who', 'is', 'are', 'does', 'do',
  'can', 'explain', 'list', 'show', 'define',
]);

/** Cheap heuristics, no LLM call — classify before picking a model. */
export function classifyComplexity(message: string): ComplexityTier {
  const text = message.trim();
  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (COMPLEX_KEYWORDS.some(kw => lower.includes(kw)) || wordCount > 80) {
    return 'complex';
  }

  const firstWord = lower.split(/\s+/)[0]?.replace(/[^a-z]/g, '') || '';
  const looksLikeQuestion = SIMPLE_LEAD_WORDS.has(firstWord) || text.endsWith('?');
  const mentionsManyFiles =
    (text.match(/\b[\w./-]+\.(ts|tsx|js|jsx|py|go|rs|java|json|md)\b/gi) || []).length > 2;

  if (looksLikeQuestion && wordCount <= 25 && !mentionsManyFiles) {
    return 'simple';
  }

  return 'medium';
}

/** Cheapest → strongest known model ids per tier, used when no explicit tier is set. */
const TIER_FALLBACKS: Record<ComplexityTier, string[]> = {
  simple:  ['groq-llama', 'deepseek-chat', 'claude-haiku-4', 'gemini-2.5-flash'],
  medium:  ['deepseek-chat', 'claude-sonnet-4', 'gemini-2.5-pro', 'openai-gpt-4o'],
  complex: ['claude-opus-4', 'openai-o3', 'claude-sonnet-4', 'gemini-2.5-pro'],
};

/**
 * Resolve which configured model should handle this tier. Prefers an
 * explicit tier->modelId mapping; falls back to the first usable
 * (non-empty apiKey) model from a fixed cost-ordered list. Returns
 * undefined if nothing usable is found — caller should keep using
 * whatever model is already active.
 */
export function resolveModelForTier(
  tier: ComplexityTier,
  models: ModelConfig[],
  explicitTiers?: Partial<Record<ComplexityTier, string>>,
): ModelConfig | undefined {
  const usable = (id?: string): ModelConfig | undefined =>
    id ? models.find(m => m.id === id && m.apiKey) : undefined;

  const explicit = usable(explicitTiers?.[tier]);
  if (explicit) return explicit;

  for (const id of TIER_FALLBACKS[tier]) {
    const found = usable(id);
    if (found) return found;
  }
  return undefined;
}
