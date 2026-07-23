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

/** A wall-clock duration: real seconds under a minute (`7.4s`), `m:ss` beyond — a fast pool would
 *  otherwise print a broken-looking `0:00` for a run that honestly took half a second. */
export function formatWallClock(seconds: number): string {
	if (seconds < 60) return `${seconds.toFixed(1)}s`;
	const minutes = Math.floor(seconds / 60);
	const rest = Math.round(seconds % 60);
	return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** A survival time in seconds, one decimal — `3.1s`. */
export function formatSeconds(value: number): string {
	return `${value.toFixed(1)}s`;
}

/** A survival FRACTION (0–1) as a whole percent — `60%`. Clamped, since a fraction can't leave [0,1]. */
export function formatSurvivalPct(value: number): string {
	return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

/** A behaviour signature, in the unit it was measured in — `48°`, `35%`, `72px`. One place, so the
 *  mechanism bars and the Markdown export read a behaviour the same way. */
export function formatBehavior(value: number, unit: 'deg' | 'frac' | 'px'): string {
	switch (unit) {
		case 'deg':
			return `${Math.round(value)}°`;
		case 'frac':
			return formatSurvivalPct(value);
		case 'px':
			return `${Math.round(value)}px`;
	}
}
