/**
 * Flee error: how wrong a fish's escape is, right now, in degrees.
 *
 * 0° is swimming dead away from the nearest predator; 180° is swimming straight into its mouth;
 * 90° is what aimless drift scores, which is why a blind population sits near 90 forever.
 *
 * This lives in the ENGINE, not in the harness that first computed it and not in the renderer that
 * now paints it, because those two must not be allowed to mean different things by the same word.
 * The number the evaluation panel reports and the colour the lens paints on a fish are the same
 * quantity, measured the same way, under the same conditions — otherwise the tank would be showing
 * one story while the card printed another, and a user comparing them would be right to trust
 * neither.
 *
 * The conditions are part of the definition:
 *
 *   • the predator must be IN VISION. A fish that cannot see the threat is not fleeing badly; it is
 *     not fleeing at all, and scoring it would be scoring the world's blindness as the fish's error.
 *   • the fish must be MOVING (above `FLEE_MIN_SPEED`). The direction of a near-stationary velocity
 *     vector is numerical noise — atan2 of two tiny numbers — and averaging that noise in would put
 *     a drifting population's error wherever the noise felt like it.
 *
 * When either fails there is NO READING, which is a different thing from a reading of zero. Hence
 * `null`, and hence the lens paints those fish in a neutral grey rather than in "perfect".
 */

import type { Fish, Predator, WorldConfig } from './types';

/** Below this speed a velocity's direction is noise, not an intention. Matches the harness. */
export const FLEE_MIN_SPEED = 12;

export interface Nearest {
	pred: Predator;
	dist: number;
}

/** The closest predator to a fish, or null in a world that has none. */
export function nearestPred(f: Fish, preds: Predator[]): Nearest | null {
	let pred: Predator | null = null;
	let best = Infinity;
	for (const p of preds) {
		const d = Math.hypot(p.x - f.x, p.y - f.y);
		if (d < best) {
			best = d;
			pred = p;
		}
	}
	return pred ? { pred, dist: best } : null;
}

/**
 * The angle between where this fish is going and dead-away-from-the-predator, in degrees (0..180).
 * `null` when there is nothing to read — see the note above.
 */
export function fleeError(
	cfg: Pick<WorldConfig, 'vision'>,
	f: Fish,
	preds: Predator[]
): number | null {
	const near = nearestPred(f, preds);
	if (!near || near.dist >= cfg.vision) return null;
	if (Math.hypot(f.vx, f.vy) <= FLEE_MIN_SPEED) return null;

	const away = Math.atan2(f.y - near.pred.y, f.x - near.pred.x);
	const vel = Math.atan2(f.vy, f.vx);
	let d = Math.abs(vel - away) % (2 * Math.PI);
	if (d > Math.PI) d = 2 * Math.PI - d;
	return (d * 180) / Math.PI;
}
