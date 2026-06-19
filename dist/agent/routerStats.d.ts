/**
 * Auto-router learning loop — v1.
 *
 * The only outcome signal available without new UI is whether the user
 * aborted (Escape/Ctrl+C) an auto-routed response. That's a noisy proxy for
 * "this model didn't deliver" (people also abort for unrelated reasons —
 * wrong question, impatience), but it's real, already-wired data instead of
 * a guessed-at shape. Tracked as a Beta(success, failure) per tier+model and
 * sampled via Thompson sampling, so the fallback list self-corrects toward
 * whichever configured model actually finishes tasks for that tier, instead
 * of always picking the same hardcoded first candidate.
 */
import type { ComplexityTier } from './router.js';
type ModelStats = {
    success: number;
    failure: number;
};
type RouterStats = Partial<Record<ComplexityTier, Record<string, ModelStats>>>;
/** Record whether an auto-routed turn completed normally or was aborted/errored. */
export declare function recordRouterOutcome(tier: ComplexityTier, modelId: string, success: boolean): void;
export declare function getRouterStats(): RouterStats;
/**
 * Thompson sampling pick among candidate model ids for this tier, in
 * cost-ascending order (cheapest first). A flat Beta(1,1) prior would make
 * brand-new, zero-data routing an even coin flip across candidates —
 * defeating the point of a cost-ordered fallback list before any evidence
 * exists. Instead each candidate's prior is biased by its cost rank (a
 * "virtual success" head start that shrinks toward the back of the list),
 * so with no data it deterministically prefers the cheapest candidate, and
 * only drifts toward a pricier one once real failures (aborted responses)
 * accumulate enough to outweigh that head start.
 */
export declare function pickByOutcomes(tier: ComplexityTier, candidateIdsCostOrder: string[]): string | undefined;
export {};
//# sourceMappingURL=routerStats.d.ts.map