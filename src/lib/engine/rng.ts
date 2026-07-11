/**
 * Randomness — the one sanctioned deviation from a byte-verbatim port.
 *
 * engine2.js calls `Math.random()` directly. Here every random draw goes through an
 * injectable `Rng`, so a world's entire evolution is reproducible from a seed (needed for
 * fair world comparisons, the §8 verification harness, and shareable seeds later). The
 * MATH that consumes the randomness — `rnd`, `randn` (Box–Muller with the same loop
 * guards) — is unchanged; only the source of the [0,1) stream is parameterized.
 *
 * Default is `Math.random` (identical stochastic behavior to the reference engine).
 */

import { TAU } from './math';

/** A source of uniform random numbers in [0, 1), like `Math.random`. */
export type Rng = () => number;

/** Production default — non-deterministic, matches the reference engine. */
export const defaultRng: Rng = Math.random;

/**
 * Deterministic PRNG (mulberry32). Tiny, fast, well-distributed — good enough for a
 * teaching sim and fully reproducible. Same seed → same stream.
 */
export function seededRng(seed: number): Rng {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Uniform draw in [a, b). Port of engine2.js `rnd`, with the rng threaded in. */
export const rnd = (rng: Rng, a: number, b: number): number => a + rng() * (b - a);

/**
 * Standard-normal draw via Box–Muller. Port of engine2.js `randn`, keeping the
 * `while (!u)` / `while (!v)` guards that reject an exact 0 (avoids log(0)).
 */
export function randn(rng: Rng): number {
	let u = 0;
	let v = 0;
	while (!u) u = rng();
	while (!v) v = rng();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}
