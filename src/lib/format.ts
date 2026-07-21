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
