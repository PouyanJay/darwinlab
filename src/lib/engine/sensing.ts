/**
 * Sensing — builds a fish brain's input vector: 8 slots (the reference brain), 9 with
 * proprioception, or 14 with the shoal senses, per the world's `brainInputs`. Faithful port of
 * engine2.js `senseInputs`, extended one optional slot-group at a time.
 *
 * THE ABLATION RULE: a disabled sense feeds 0 into its input slot. The neuron still
 * exists; it just receives nothing — so toggling a sense off is a true ablation, not a
 * network-shape change (CLAUDE.md golden rule).
 *
 * Inputs found only within `cfg.vision` of the nearest predator; wall rays cast three
 * directions (−0.5, 0, +0.5 rad off heading) when the walls sense is on.
 */

import { clamp } from './math';
import {
	CLOSING_NORM,
	WALL_RAY_NORM,
	MAXSPEED,
	SOCIAL_RADIUS,
	SHOAL_DENSITY_NORM
} from './constants';
import { NIN } from './network';
import type { World, Fish, Predator, SenseResult } from './types';

export function senseInputs(
	w: Pick<World, 'cfg' | 'preds'> & { fish?: Fish[] },
	f: Fish
): SenseResult {
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

	// slots 9–13 — the shoal sense, filled by senseShoal (kept out of line, like the wall-ray block
	// would be if it were newer, so senseInputs reads as one slot-group after another).
	if (nin > 8 && (S.cohesion || S.align)) senseShoal(w, f, x);

	return { x, np, dist: np ? nd : Infinity, inVis, dirDeg, closing, wallFront: wF };
}

/**
 * The SHOAL sense (cohesion + alignment), slots 9–13. Unlike every predator sense it is about OTHER
 * FISH: a single scan of the neighbours within `socialRadius` yields how crowded it is (density),
 * which way their centre-of-mass lies (cohesion), and which way they are collectively pointing
 * (alignment). Bearings are relative to the fish's own heading (sin/cos), the same encoding the
 * direction sense uses, so the network reads "turn toward the group" the way it reads "flee the
 * shark". Ablated like the rest — a slot whose sense is off keeps its 0. Absent `w.fish` (staged
 * single-fish trials — the flee assay) there is no shoal, so the slots stay 0, which is right.
 */
function senseShoal(w: Pick<World, 'cfg'> & { fish?: Fish[] }, f: Fish, x: number[]): void {
	if (!w.fish) return;
	const S = w.cfg.senses;
	const R = w.cfg.socialRadius ?? SOCIAL_RADIUS;
	let n = 0;
	let sx = 0;
	let sy = 0;
	let hx = 0;
	let hy = 0;
	for (const o of w.fish) {
		if (o === f) continue;
		const dx = o.x - f.x;
		const dy = o.y - f.y;
		if (Math.hypot(dx, dy) >= R) continue;
		n++;
		sx += dx;
		sy += dy;
		hx += Math.cos(o.heading);
		hy += Math.sin(o.heading);
	}
	if (n === 0) return;
	if (S.cohesion) {
		x[9] = clamp(n / SHOAL_DENSITY_NORM, 0, 1);
		const com = Math.atan2(sy, sx) - f.heading;
		x[10] = Math.sin(com);
		x[11] = Math.cos(com);
	}
	if (S.align) {
		const mean = Math.atan2(hy, hx) - f.heading;
		x[12] = Math.sin(mean);
		x[13] = Math.cos(mean);
	}
}
