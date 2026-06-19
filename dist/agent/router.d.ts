/**
 * Auto-router — classifies a task's complexity with cheap heuristics (no LLM
 * call) and resolves which configured model should handle it, so a quick
 * lookup doesn't pay for an expensive model and a hard refactor doesn't get
 * shortchanged by a weak one.
 */
import type { ModelConfig } from '../config/types.js';
export type ComplexityTier = 'simple' | 'medium' | 'complex';
/** Cheap heuristics, no LLM call — classify before picking a model. */
export declare function classifyComplexity(message: string): ComplexityTier;
/**
 * Resolve which configured model should handle this tier. Prefers an
 * explicit tier->modelId mapping; falls back to the first usable
 * (non-empty apiKey) model from a fixed cost-ordered list. Returns
 * undefined if nothing usable is found — caller should keep using
 * whatever model is already active.
 */
export declare function resolveModelForTier(tier: ComplexityTier, models: ModelConfig[], explicitTiers?: Partial<Record<ComplexityTier, string>>): ModelConfig | undefined;
//# sourceMappingURL=router.d.ts.map