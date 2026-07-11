/**
 * Shared test fixtures for the engine specs.
 *
 * Test-only: nothing in `src/` imports this outside a `*.spec.ts`, so it is tree-shaken out of
 * the app bundle. It exists so the WorldConfig / Fish / Predator builders live in ONE place —
 * previously each spec carried its own copy, which would silently drift the moment WorldConfig
 * gained a field.
 */

import { makeGenome } from './network';
import { seededRng } from './rng';
import type { WorldConfig, Fish, Predator, Senses } from './types';

export const ALL_SENSES: Senses = { dist: true, dir: true, closing: true, walls: true };

/** The standard bench config (20 prey · 2 sharks · 640×400), overridable per test. */
export function testCfg(over: Partial<WorldConfig> = {}): WorldConfig {
	return {
		name: 'w',
		accent: '#000',
		prey: 20,
		preds: 2,
		bw: 640,
		bh: 400,
		predSpeed: 1,
		vision: 200,
		mutation: 0.06,
		senses: { ...ALL_SENSES },
		caption: '',
		...over
	};
}

export function testPred(x: number, y: number, vx = 0, vy = 0): Predator {
	return { x, y, vx, vy, heading: 0, lunge: 0, cool: 0, aim: 0, trail: [], trailT: 0 };
}

export function testFish(over: Partial<Fish> = {}): Fish {
	return {
		x: 0,
		y: 0,
		vx: 0,
		vy: 0,
		heading: 0,
		trail: [],
		phase: 0,
		size: 1,
		genome: makeGenome(seededRng(1)),
		fitness: 0,
		turn: 0,
		thrust: 0,
		trailT: 0,
		...over
	};
}
