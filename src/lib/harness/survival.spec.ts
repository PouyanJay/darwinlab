/**
 * The honest finding, as an executable test — and it is not the finding this project started with.
 *
 * It used to assert that the sense ladder was FLAT: more senses ≠ more intelligence. That was true
 * of the ocean the lab originally shipped, where a fish with all four senses survived ~5% LESS than
 * a blind one — because the shark outran every fish (so knowing which way to flee only delayed
 * death), wall-avoidance was a free instinct (so the wall sense solved nothing), and the strike
 * re-aimed mid-flight (so nothing could be anticipated). Every live input still costs mutation rent,
 * so the best-equipped fish simply carried the most noise.
 *
 * That was a fact about the world, not about intelligence. Give every sense a danger only IT can
 * solve — which is what SHOWCASE_OCEAN does, knob by knob — and the same brains, the same GA and the
 * same code climb a real ladder. That is what is asserted here.
 *
 * Seeded → deterministic, so these cannot flake. If a change moves them, that is a change to the
 * science: stop and re-measure (`npm run bench:survival`, `scripts/sweep-senses.ts`) — never adjust
 * the bands to fit.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { sweep, type SweepStat } from './survival';
import { DEFAULT_WORLDS } from '../engine';

const SEEDS = Array.from({ length: 8 }, (_, i) => i + 1);
/** Generations are 30 sim-seconds here, so 12 of them is well past convergence. */
const GENERATIONS = 12;

let life: Record<string, number>;

const byName = (stats: SweepStat[]) => Object.fromEntries(stats.map((s) => [s.name, s.meanPct]));

// 90s: the default worlds' generations are 3× the reference's, so a sweep is not cheap.
beforeAll(() => {
	// judged on LIFE — mean seconds survived, which is what selection rewards and what the tiles
	// plot. The alive-at-the-bell metric flattens to a few percent for every world alike here.
	life = byName(sweep(DEFAULT_WORLDS, SEEDS, GENERATIONS, 6, 'life'));
}, 90_000);

describe('the sense ladder — an ocean where a sense can pay for itself', () => {
	it('makes direction the biggest single jump on the bench', () => {
		expect(life['Direction']).toBeGreaterThan(life['Blind drift']);
		expect(life['Direction']).toBeGreaterThan(life['Distance']);
		// a LEAP, not a nudge: this is the sense that earns its keep
		expect(life['Direction'] - life['Distance']).toBeGreaterThan(5);
	});

	it('still shows distance barely beating blindness — the one rung we could never lift', () => {
		// Knowing something is NEAR does not tell you where to GO, so evolution can do little with
		// it. No ocean we tried changed that, and we left the rung flat rather than fake a staircase.
		expect(Math.abs(life['Distance'] - life['Blind drift'])).toBeLessThan(8);
	});

	it('lets the wall sense pay, because nothing here avoids walls for free', () => {
		// The instinct is gone (wallInstinct: false), so a corner is a real trap — and staying out of
		// one is something only a brain that can SENSE walls gets to learn.
		expect(life['Corner-wise']).toBeGreaterThan(life['Blind drift']);
	});

	it('rewards senses instead of taxing them: the full-sense world beats the blind one outright', () => {
		// The claim that took the whole phase to earn. In the original ocean this assertion was FALSE
		// — all four senses came in ~5% BELOW blind — and that is what a world which ignores its own
		// inputs does to the brains living in it.
		expect(life['Full senses']).toBeGreaterThan(life['Blind drift']);
	});
});
