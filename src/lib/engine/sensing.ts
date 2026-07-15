/**
 * Sensing — builds the fixed 8-slot input vector for a fish's brain. Faithful port of
 * engine2.js `senseInputs`.
 *
 * THE ABLATION RULE: a disabled sense feeds 0 into its input slot. The neuron still
 * exists; it just receives nothing — so toggling a sense off is a true ablation, not a
 * network-shape change (CLAUDE.md golden rule).
 *
 * Inputs found only within `cfg.vision` of the nearest predator; wall rays cast three
 * directions (−0.5, 0, +0.5 rad off heading) when the walls sense is on.
 */

import { clamp } from './math';
import { CLOSING_NORM, WALL_RAY_NORM, MAXSPEED } from './constants';
import { NIN } from './network';
import type { World, Fish, Predator, SenseResult } from './types';

export function senseInputs(w: Pick<World, 'cfg' | 'preds'>, f: Fish): SenseResult {
	const c = w.cfg;
	const S = c.senses;

	let np: Predator | null = null;
	let nd = 1e9;
	for (const p of w.preds) {
		const d = Math.hypot(p.x - f.x, p.y - f.y);
		if (d < nd) {
			nd = d;
			np = p;
		}
	}
	const inVis = !!np && nd < c.vision;

	// The vector is as long as this world's brains are wide: 8 slots (the reference brain) or
	// 9, where the extra one is PROPRIOCEPTION — the fish's own speed. Unlike every other
	// input it does not depend on the predator at all, and it is the only way a brain can
	// learn "I am slower than that thing, so running straight is death — cut instead".
	const nin = c.brainInputs ?? NIN;
	const x = new Array<number>(nin).fill(0);
	x[0] = 1;
	let dirDeg = 0;
	let closing = 0;
	if (np) {
		const rx = (f.x - np.x) / (nd || 1);
		const ry = (f.y - np.y) / (nd || 1);
		closing = -((f.vx - np.vx) * rx + (f.vy - np.vy) * ry);
		dirDeg = (Math.atan2(np.y - f.y, np.x - f.x) * 180) / Math.PI;
	}

	if (S.dist && inVis) x[1] = clamp(1 - nd / c.vision, 0, 1);
	if (S.dir && inVis && np) {
		const rel = Math.atan2(np.y - f.y, np.x - f.x) - f.heading;
		x[2] = Math.sin(rel);
		x[3] = Math.cos(rel);
	}
	if (S.closing && inVis) x[4] = clamp(closing / CLOSING_NORM, 0, 1);

	let wF = 1e9;
	if (S.walls) {
		const rays = [-0.5, 0, 0.5];
		for (let r = 0; r < 3; r++) {
			const a = f.heading + rays[r];
			const cx = Math.cos(a);
			const cy = Math.sin(a);
			let t = 1e9;
			if (cx > 0) t = Math.min(t, (c.bw - f.x) / cx);
			if (cx < 0) t = Math.min(t, -f.x / cx);
			if (cy > 0) t = Math.min(t, (c.bh - f.y) / cy);
			if (cy < 0) t = Math.min(t, -f.y / cy);
			x[5 + r] = clamp(1 - t / WALL_RAY_NORM, 0, 1);
			if (r === 1) wF = t;
		}
	} else {
		const cx = Math.cos(f.heading);
		const cy = Math.sin(f.heading);
		let t = 1e9;
		if (cx > 0) t = Math.min(t, (c.bw - f.x) / cx);
		if (cx < 0) t = Math.min(t, -f.x / cx);
		if (cy > 0) t = Math.min(t, (c.bh - f.y) / cy);
		if (cy < 0) t = Math.min(t, -f.y / cy);
		wF = t;
	}

	// slot 8 — own speed, normalized by the fish's own top speed (so 1 = flat out).
	// Ablated like any other sense: off feeds 0, the neuron stays, the shape never changes.
	// Normalised by the agent's OWN top speed, not the constant: in a world where the fish max out at
	// 250, a fish going 250 must read 1.0, not 250/176.
	if (nin > 8 && S.speed) x[8] = clamp(Math.hypot(f.vx, f.vy) / (w.cfg.maxSpeed ?? MAXSPEED), 0, 1);

	return { x, np, dist: np ? nd : Infinity, inVis, dirDeg, closing, wallFront: wF };
}
