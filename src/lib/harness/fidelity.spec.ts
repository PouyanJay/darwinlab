/**
 * THE PORT FIDELITY GATE (Phase 1).
 *
 * Proves `src/lib/engine` did not change the science, by running it head-to-head against the
 * untouched vendored reference (`reference/engine2.js`).
 *
 * The trick: both engines draw randomness from `Math.random` (our `defaultRng` late-binds to
 * it). If the port consumes draws in the SAME ORDER as the reference, then seeding
 * `Math.random` with the same deterministic stream makes both engines produce *bit-identical*
 * trajectories. That is a far stronger claim than "the averages look similar" — it means every
 * position, every kill, every bred genome matches exactly.
 *
 * If this test ever fails, the port has diverged from the reference. Do not "fix" it by
 * loosening the assertion.
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as mine from '../engine';
import * as ref from '../../../reference/engine2.js';
import { seededRng } from '../engine';
import type { World, WorldConfig } from '../engine';

const DT = 1 / 60;
const realRandom = Math.random;

afterEach(() => {
	Math.random = realRandom;
});

/** Build + step a world with `Math.random` seeded, so both engines share one draw stream. */
function runSeeded(
	makeWorld: (cfg: WorldConfig) => unknown,
	stepWorld: (w: unknown, dt: number) => void,
	cfg: WorldConfig,
	seed: number,
	steps: number
): World {
	Math.random = seededRng(seed);
	const w = makeWorld(JSON.parse(JSON.stringify(cfg))) as World;
	for (let i = 0; i < steps; i++) stepWorld(w, DT);
	Math.random = realRandom;
	return w;
}

/** The observable state that must match exactly. */
function snapshot(w: World) {
	return {
		gen: w.gen,
		eaten: w.eaten,
		fishCount: w.fish.length,
		predCount: w.preds.length,
		curve: w.curve,
		fish: w.fish.map((f) => [f.x, f.y, f.heading, f.vx, f.vy, f.fitness]),
		preds: w.preds.map((p) => [p.x, p.y, p.heading, p.lunge, p.aim]),
		champion: w.champion ? [w.champion.fitness, w.champion.gen, [...w.champion.genome]] : null
	};
}

const refWorlds = ref.DEFAULT_WORLDS as WorldConfig[];

describe('port fidelity: src/lib/engine ≡ reference/engine2.js', () => {
	// 1200 steps ≈ 20 sim-seconds — spans generation boundaries, evolution, kills and breeding
	const STEPS = 1200;

	for (let i = 0; i < 5; i++) {
		it(`produces bit-identical state for "${refWorlds[i].name}"`, () => {
			const cfg = refWorlds[i];
			const seed = 1000 + i;

			const expected = runSeeded(ref.makeWorld, ref.stepWorld, cfg, seed, STEPS);
			const actual = runSeeded(
				(c) => mine.makeWorld(c),
				(w, dt) => mine.stepWorld(w as World, dt),
				cfg,
				seed,
				STEPS
			);

			// sanity: the run actually exercised evolution, not just an empty tank
			expect(expected.gen).toBeGreaterThanOrEqual(1);
			expect(snapshot(actual)).toEqual(snapshot(expected));
		});
	}

	it('keeps matching deep into evolution (10 generations)', () => {
		const cfg = refWorlds[2]; // Direction
		const seed = 4242;
		const deepSteps = 6000; // ~100 sim-seconds → ~10 generations

		const expected = runSeeded(ref.makeWorld, ref.stepWorld, cfg, seed, deepSteps);
		const actual = runSeeded(
			(c) => mine.makeWorld(c),
			(w, dt) => mine.stepWorld(w as World, dt),
			cfg,
			seed,
			deepSteps
		);

		expect(expected.gen).toBeGreaterThanOrEqual(5);
		expect(snapshot(actual)).toEqual(snapshot(expected));
	});
});
