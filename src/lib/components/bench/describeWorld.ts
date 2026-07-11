/**
 * The one-line description of a world's conditions, as the tile's meta chip says it:
 *
 *   "20 prey · 2 sharks · 640×400"          the defaults
 *   "20 prey · 2 sharks · 640×400 · 1.4×"   ...and a predator that has been sped up
 *
 * Extracted from the tile because it is real logic with real edge cases — pluralisation, and a
 * predator speed that must read as "1.4×" and "2×", never "1.40×" or "2.0×" — and logic with edge
 * cases wants a test, not a template string buried in markup.
 */

import type { WorldConfigView } from '$lib/state';

/** Below this, a predator-speed tweak is a rounding artefact rather than a condition worth stating. */
const SPEED_EPSILON = 0.001;

/** Trim a multiplier to at most 2dp and drop the trailing zeros: 1.4 → "1.4", 2 → "2". */
function multiplier(value: number): string {
	return `${Number(value.toFixed(2))}×`;
}

export function describeWorld(config: WorldConfigView): string {
	const parts = [
		`${config.prey} prey`,
		`${config.preds} ${config.preds === 1 ? 'shark' : 'sharks'}`,
		`${config.bw}×${config.bh}`
	];
	// The default speed is the baseline the whole bench is calibrated against, so it goes unsaid;
	// any departure from it is a condition of the experiment and has to be on the tile.
	if (Math.abs(config.predSpeed - 1) > SPEED_EPSILON) parts.push(multiplier(config.predSpeed));
	return parts.join(' · ');
}
