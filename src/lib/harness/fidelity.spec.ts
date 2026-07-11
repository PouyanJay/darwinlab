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
 * position, every kill, every bred genome matches exactly. Add or drop a single random draw
 * anywhere and every subsequent draw decorrelates, so this fails loudly.
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

type MakeWorld = (cfg: WorldConfig) => unknown;
type StepWorld = (w: unknown, dt: number) => void;

/**
 * Build + step a world with `Math.random` seeded, so both engines share one draw stream.
 * `setup` runs after construction (before any stepping) — used to enter deployed mode.
 */
function runSeeded(
	makeWorld: MakeWorld,
	stepWorld: StepWorld,
	cfg: WorldConfig,
	seed: number,
	steps: number,
	setup?: (w: World) => void
): World {
	Math.random = seededRng(seed);
	try {
		const w = makeWorld(JSON.parse(JSON.stringify(cfg))) as World;
		setup?.(w);
		for (let i = 0; i < steps; i++) stepWorld(w, DT);
		return w;
	} finally {
		Math.random = realRandom;
	}
}

/** The observable state that must match exactly — training AND deployment. */
function snapshot(w: World) {
	return {
		gen: w.gen,
		genT: w.genT,
		eaten: w.eaten,
		sinceKill: w.sinceKill,
		fishCount: w.fish.length,
		predCount: w.preds.length,
		curve: w.curve,
		fish: w.fish.map((f) => [f.x, f.y, f.heading, f.vx, f.vy, f.fitness, f.turn, f.thrust]),
		preds: w.preds.map((p) => [p.x, p.y, p.heading, p.vx, p.vy, p.lunge, p.aim, p.cool]),
		champion: w.champion ? [w.champion.fitness, w.champion.gen, [...w.champion.genome]] : null,
		// deployment lifecycle — the half of stepWorld that only runs once maxGen is reached
		deployed: w._deployed,
		deployT: w.deployT,
		decay: w.decay,
		halfLife: w.halfLife,
		extinctT: w.extinctT,
		deployStartN: w.deployStartN
	};
}

const refWorlds = ref.DEFAULT_WORLDS as WorldConfig[];
const mineMake: MakeWorld = (c) => mine.makeWorld(c);
const mineStep: StepWorld = (w, dt) => mine.stepWorld(w as World, dt);

describe('port fidelity: src/lib/engine ≡ reference/engine2.js', () => {
	describe('training (evolving)', () => {
		// 1200 steps ≈ 20 sim-seconds — spans generation boundaries, evolution, kills and breeding
		const STEPS = 1200;

		for (let i = 0; i < 5; i++) {
			it(`produces bit-identical state for "${refWorlds[i].name}"`, () => {
				const cfg = refWorlds[i];
				const seed = 1000 + i;

				const expected = runSeeded(ref.makeWorld, ref.stepWorld, cfg, seed, STEPS);
				const actual = runSeeded(mineMake, mineStep, cfg, seed, STEPS);

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
			const actual = runSeeded(mineMake, mineStep, cfg, seed, deepSteps);

			expect(expected.gen).toBeGreaterThanOrEqual(5);
			expect(snapshot(actual)).toEqual(snapshot(expected));
		});
	});

	/**
	 * The deployed half of the lifecycle. This is the ONLY region where the port made
	 * structural changes (it omits the reference's never-called `reseedTrained` /
	 * `trainedGenome` / `edgeSpawn`, and drops the vestigial `respawnQ`), so it is exactly
	 * where divergence risk lives — and it is unreachable unless maxGen is set.
	 */
	describe('deployment (post-training decay)', () => {
		const setMaxGen = (n: number) => (w: World) => {
			w.maxGen = n;
		};

		for (let i = 0; i < 5; i++) {
			it(`decays bit-identically after training for "${refWorlds[i].name}"`, () => {
				const cfg = refWorlds[i];
				const seed = 2000 + i;
				// train 2 generations, then run deep into the deployed run (no respawns → extinction)
				const steps = 9000; // ~150 sim-seconds

				const expected = runSeeded(ref.makeWorld, ref.stepWorld, cfg, seed, steps, setMaxGen(2));
				const actual = runSeeded(mineMake, mineStep, cfg, seed, steps, setMaxGen(2));

				// sanity: we really entered deployed mode and the population really decayed
				expect(expected._deployed).toBe(true);
				expect(expected.decay.length).toBeGreaterThan(0);
				expect(expected.halfLife).not.toBeNull();

				expect(snapshot(actual)).toEqual(snapshot(expected));
			});
		}

		it('records identical extinction time and never respawns', () => {
			const cfg = refWorlds[0]; // Blind drift — dies fastest
			const seed = 7777;
			const expected = runSeeded(ref.makeWorld, ref.stepWorld, cfg, seed, 12000, setMaxGen(1));
			const actual = runSeeded(mineMake, mineStep, cfg, seed, 12000, setMaxGen(1));

			expect(expected.extinctT).not.toBeNull(); // the tank really emptied
			expect(expected.fish).toHaveLength(0);
			expect(snapshot(actual)).toEqual(snapshot(expected));
		});
	});
});
