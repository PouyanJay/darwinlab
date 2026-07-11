/**
 * Headless survival harness (golden rule #4).
 *
 * Runs the pure engine for N generations across many seeds and prints the converged
 * survival rates so we can verify a port/edit reproduces the README §8 finding:
 *   Blind ~24% · Distance ~32% · Direction ~59% · Anticipation ~46% · Corner-wise ~43%
 *
 * Imports ONLY from `$lib/engine` (never from Svelte or the DOM). Run with a plain
 * node/tsx invocation or a Vitest assertion — this is the proof the science is intact.
 *
 * TODO(engine-port): implement once the engine modules exist.
 */
export {};
