import { describe, it, expect } from 'vitest';
import { drawWorld } from './drawWorld';
import { makeWorld, stepWorld, seededRng, DEFAULT_WORLDS } from '../engine';
import type { World } from '../engine';

/**
 * The lens's whole promise, in two parts:
 *
 *   1. it CHANGES WHAT YOU SEE — otherwise it is a switch that does nothing;
 *   2. it CHANGES NOTHING ELSE — no weight, no fitness, no position, no RNG draw.
 *
 * The second is the one that matters. A "way of looking" that quietly perturbs the simulation would
 * mean every screenshot in this product was taken of a different experiment than the one the numbers
 * came from, and nobody would ever find out from the picture.
 */

/** Everything about a world that the simulation is: where everyone is, what they know, what they are worth. */
function stateOf(w: World) {
	return JSON.stringify({
		t: w.t,
		gen: w.gen,
		eaten: w.eaten,
		curve: w.curve,
		lifeCurve: w.lifeCurve,
		fish: w.fish.map((f) => [f.x, f.y, f.vx, f.vy, f.heading, f.fitness, Array.from(f.genome)]),
		preds: w.preds.map((p) => [p.x, p.y, p.vx, p.vy, p.heading, p.lunge, p.cool, p.aim])
	});
}

/** A recording 2D context: every fill colour it is ever handed, in order. */
function recorder() {
	const fills: string[] = [];
	const ctx = new Proxy(
		{},
		{
			get(_t, key) {
				if (key === 'canvas') return { width: 640, height: 400 };
				if (key === 'createLinearGradient' || key === 'createRadialGradient') {
					return () => ({ addColorStop() {} });
				}
				if (key === 'fillStyle' || key === 'strokeStyle') return '';
				return () => {};
			},
			set(_t, key, value) {
				if (key === 'fillStyle' && typeof value === 'string') fills.push(value);
				return true;
			}
		}
	) as unknown as CanvasRenderingContext2D;
	return { ctx, fills };
}

function warmed(seconds: number): World {
	const cfg = DEFAULT_WORLDS[2]; // Direction — a world whose fish actually flee
	const w = makeWorld(cfg, undefined, seededRng(11));
	for (let i = 0; i < seconds * 60; i++) stepWorld(w, 1 / 60);
	return w;
}

describe('the flee lens', () => {
	it('paints the fish in colours the plain view never uses', () => {
		const w = warmed(4);

		const plain = recorder();
		drawWorld(w, plain.ctx, 640, 400, { theme: 'light', lens: 'none' });

		const lensed = recorder();
		drawWorld(w, lensed.ctx, 640, 400, { theme: 'light', lens: 'flee' });

		// The ramp is rgb(...) triplets computed per fish; the palette's own fish colour is a hex.
		const ramp = lensed.fills.filter((c) => c.startsWith('rgb(') && !c.startsWith('rgba('));
		expect(ramp.length).toBeGreaterThan(0);
		expect(plain.fills.filter((c) => c.startsWith('rgb(') && !c.startsWith('rgba('))).toEqual([]);
	});

	it('does not touch the simulation — not one weight, position or draw', () => {
		const a = warmed(4);
		const b = warmed(4);
		expect(stateOf(a)).toBe(stateOf(b)); // the two runs start identical, or nothing below means anything

		// Paint one under the lens, one without, then keep stepping BOTH.
		for (let i = 0; i < 120; i++) {
			drawWorld(a, recorder().ctx, 640, 400, { theme: 'light', lens: 'flee' });
			drawWorld(b, recorder().ctx, 640, 400, { theme: 'light', lens: 'none' });
			stepWorld(a, 1 / 60);
			stepWorld(b, 1 / 60);
		}

		// Two seconds of simulation later they are still the same world, fish for fish, weight for
		// weight. A lens that had consumed a single RNG draw would have diverged here.
		expect(stateOf(a)).toBe(stateOf(b));
	});
});
