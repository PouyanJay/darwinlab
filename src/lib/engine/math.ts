/**
 * Small pure math helpers, ported verbatim from engine2.js.
 * No randomness lives here (see rng.ts) — these are deterministic given their inputs.
 */

/** Full turn in radians (2π). */
export const TAU = Math.PI * 2;

/** Clamp `v` into [a, b]. Branch order matches the original engine. */
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/**
 * Interpolate from angle `a` toward angle `b` by fraction `t`, taking the shortest
 * way around the circle. Verbatim port of engine2.js `lerpAngle`.
 */
export function lerpAngle(a: number, b: number, t: number): number {
	let d = (b - a) % TAU;
	if (d > Math.PI) d -= TAU;
	if (d < -Math.PI) d += TAU;
	return a + d * t;
}
