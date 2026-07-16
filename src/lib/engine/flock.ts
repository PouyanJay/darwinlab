/**
 * Flocking order parameters — pure, framework-free readings of how much a population moves as a
 * school. They live in the engine (not the harness) because BOTH the headless sweep and the live
 * UI read them: the sweep to measure whether schooling evolved, the card to show it happening.
 *
 * Neither is ever an input to selection — fitness stays seconds survived. These only observe.
 */

/** Below this speed a fish has no meaningful heading, so it does not vote on polarization. */
const MOVING_EPS = 6;

/**
 * Polarization φ ∈ [0,1]: the magnitude of the mean unit-velocity vector over the fish that are
 * actually moving. 0 is chaos (every fish its own way), 1 a perfectly aligned school. Stationary
 * fish (speed < MOVING_EPS) have no direction and are excluded; with none moving, φ = 0.
 */
export function polarization(fish: readonly { vx: number; vy: number }[]): number {
	let sx = 0;
	let sy = 0;
	let n = 0;
	for (const f of fish) {
		const sp = Math.hypot(f.vx, f.vy);
		if (sp < MOVING_EPS) continue;
		sx += f.vx / sp;
		sy += f.vy / sp;
		n++;
	}
	return n ? Math.hypot(sx, sy) / n : 0;
}

/**
 * Mean nearest-neighbour distance (px): for each fish, the distance to its closest neighbour,
 * averaged. A tight school scores low. Undefined below two fish (there is no neighbour), so it
 * returns null — a caller time-averaging this must skip a null sample rather than fold a zero in
 * (which would read as "perfectly packed" for an all-but-empty tank).
 */
export function meanNearestNeighbor(fish: readonly { x: number; y: number }[]): number | null {
	if (fish.length < 2) return null;
	let sum = 0;
	for (let i = 0; i < fish.length; i++) {
		let nd = Infinity;
		for (let j = 0; j < fish.length; j++) {
			if (i === j) continue;
			const d = Math.hypot(fish[i].x - fish[j].x, fish[i].y - fish[j].y);
			if (d < nd) nd = d;
		}
		sum += nd;
	}
	return sum / fish.length;
}
