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
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
const STATS_PATH = path.join(os.homedir(), '.aegiscode', 'router-stats.json');
let cache = null;
function load() {
    if (cache)
        return cache;
    try {
        cache = JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'));
    }
    catch {
        cache = {};
    }
    return cache;
}
function save(stats) {
    cache = stats;
    try {
        fs.mkdirSync(path.dirname(STATS_PATH), { recursive: true });
        fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
    }
    catch { /* non-fatal — learning is best-effort */ }
}
/** Record whether an auto-routed turn completed normally or was aborted/errored. */
export function recordRouterOutcome(tier, modelId, success) {
    const stats = load();
    const tierStats = stats[tier] || (stats[tier] = {});
    const modelStats = tierStats[modelId] || (tierStats[modelId] = { success: 0, failure: 0 });
    if (success)
        modelStats.success += 1;
    else
        modelStats.failure += 1;
    save(stats);
}
export function getRouterStats() {
    return load();
}
/** Marsaglia-Tsang gamma sampler — shape > 0, scale 1. */
function sampleGamma(shape) {
    if (shape < 1) {
        // Boost via Johnk's trick: Gamma(shape) = Gamma(shape+1) * U^(1/shape)
        const u = Math.random();
        return sampleGamma(shape + 1) * Math.pow(u, 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
        let x;
        let v;
        do {
            // Box-Muller for a standard normal sample
            const u1 = Math.random() || Number.EPSILON;
            const u2 = Math.random();
            x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
            v = 1 + c * x;
        } while (v <= 0);
        v = v * v * v;
        const u = Math.random();
        if (u < 1 - 0.0331 * (x * x) * (x * x))
            return d * v;
        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v)))
            return d * v;
    }
}
function sampleBeta(alpha, beta) {
    const ga = sampleGamma(alpha);
    const gb = sampleGamma(beta);
    return ga / (ga + gb);
}
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
export function pickByOutcomes(tier, candidateIdsCostOrder) {
    const n = candidateIdsCostOrder.length;
    if (n === 0)
        return undefined;
    if (n === 1)
        return candidateIdsCostOrder[0];
    const stats = load();
    const tierStats = stats[tier] || {};
    let best;
    let bestScore = -Infinity;
    candidateIdsCostOrder.forEach((id, i) => {
        const priorBonus = (n - 1 - i) * 3; // cheapest gets the biggest head start
        const s = tierStats[id];
        const score = sampleBeta(1 + priorBonus + (s?.success ?? 0), 1 + (s?.failure ?? 0));
        if (score > bestScore) {
            bestScore = score;
            best = id;
        }
    });
    return best;
}
//# sourceMappingURL=routerStats.js.map