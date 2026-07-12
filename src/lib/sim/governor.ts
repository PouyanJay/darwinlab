/**
 * Detail governor — watches real frame times and decides when this machine cannot afford
 * cinematic rendering.
 *
 * One lever: the story stage's `cinematic` detail (god-rays, animated gradients). Bench tiles
 * already run at `performance`. The governor is a one-way ratchet — no recovery path — because
 * the cost it removes is exactly what would make the average recover, and a stage that flaps
 * between two looks is worse than either of them.
 *
 * A background tab is NOT a slow machine: the loop is a `setTimeout` throttled to ~1s when the
 * tab is hidden, so anything over `OUTLIER_SECONDS` is treated as "the tab was away" (or a
 * breakpoint, or a laptop lid), not as evidence.
 */

/** Frames longer than this are hidden-tab / debugger gaps, not rendering cost — never counted. */
export const OUTLIER_SECONDS = 0.25;
/** Downgrade once the smoothed frame time crosses this (≈42fps — visibly not keeping up). */
export const DOWNGRADE_SECONDS = 0.024;
/** Withhold judgment for the first frames — startup jank would downgrade every machine. */
export const WARMUP_FRAMES = 30;
/** EMA smoothing per frame — small enough that one GC pause cannot cross the line alone. */
const SMOOTHING = 0.05;

export class DetailGovernor {
	#average = 0;
	#samples = 0;
	#degraded = false;

	get degraded(): boolean {
		return this.#degraded;
	}

	/**
	 * Feed one real frame duration (seconds). Returns true on the single sample that crosses the
	 * line, so the caller flips its detail state exactly once.
	 */
	sample(frameSeconds: number): boolean {
		if (this.#degraded || frameSeconds > OUTLIER_SECONDS) return false;
		this.#samples++;
		this.#average =
			this.#samples === 1
				? frameSeconds
				: this.#average + SMOOTHING * (frameSeconds - this.#average);
		if (this.#samples < WARMUP_FRAMES || this.#average <= DOWNGRADE_SECONDS) return false;
		this.#degraded = true;
		return true;
	}
}
