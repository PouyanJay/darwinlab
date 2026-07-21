/**
 * Small UI formatting helpers — one place per convention, so the same quantity reads the same
 * everywhere it appears.
 */

/**
 * A signed survival delta in seconds: `+2.4s`, `0.0s`, `-1.1s`. Positives get a leading `+`; the
 * negative sign is the native one `toFixed` produces — the convention the lab's readouts already use.
 */
export function formatSignedSeconds(value: number): string {
	return `${value > 0 ? '+' : ''}${value.toFixed(1)}s`;
}

/** A survival time in seconds, one decimal — `3.1s`. */
export function formatSeconds(value: number): string {
	return `${value.toFixed(1)}s`;
}

/** A survival FRACTION (0–1) as a whole percent — `60%`. Clamped, since a fraction can't leave [0,1]. */
export function formatSurvivalPct(value: number): string {
	return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}
