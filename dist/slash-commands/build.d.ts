/**
 * /build — Parallel multi-model app builder
 *
 * Decomposes a task into components, assigns each to the best available model,
 * builds everything in parallel, then synthesizes results.
 *
 * Phases:
 *   1. Plan  — primary model produces a JSON component tree
 *   2. Build — all components run in parallel (different models per role)
 *   3. Sync  — primary model synthesizes and reports what was written
 */
import type { SlashCommand } from './types.js';
export declare const buildCommand: SlashCommand;
//# sourceMappingURL=build.d.ts.map