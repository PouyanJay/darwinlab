/**
 * Pointer picking. Faithful port of engine2.js `pickCreature`.
 *
 * Inverts the fit-scale transform that `drawWorld` stored on the world, mapping canvas
 * coordinates back into logical tank units, then hit-tests predators first (they're bigger
 * and sit visually on top), then the nearest fish within a small radius.
 *
 * Returns null if the world has not been drawn yet (no transform) or nothing was hit.
 */

import type { World, Fish, Predator } from '../engine';

export type Picked = { type: 'fish'; obj: Fish } | { type: 'pred'; obj: Predator };

export function pickCreature(w: World, x: number, y: number): Picked | null {
	if (!w.transform) return null;
	const { s, ox, oy } = w.transform;
	const wx = (x - ox) / s;
	const wy = (y - oy) / s;

	for (const p of w.preds) {
		if (Math.hypot(p.x - wx, p.y - wy) < 26) return { type: 'pred', obj: p };
	}
	let best: Fish | null = null;
	let bd = 1e9;
	for (const f of w.fish) {
		const d = Math.hypot(f.x - wx, f.y - wy);
		if (d < 16 && d < bd) {
			bd = d;
			best = f;
		}
	}
	return best ? { type: 'fish', obj: best } : null;
}
