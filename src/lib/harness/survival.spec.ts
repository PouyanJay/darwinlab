/**
 * The honest finding, as an executable test — and it is not the finding we started with.
 *
 * We used to assert that the sense ladder was flat: more senses ≠ more intelligence. That was
 * true of the ORIGINAL ocean, and it is still asserted below against REFERENCE_WORLDS — where,
 * measured, a fish with all four senses does WORSE than a blind one, because every live input
 * costs mutation rent and none of them buys anything (the shark outruns you, so knowing which
 * way to flee only delays death; wall-avoidance is a free instinct, so wall-sensing solves
 * nothing; the strike re-aims mid-flight, so nothing can be anticipated).
 *
 * That is not a fact about intelligence. It is a fact about that world. Give every sense a real
 * danger to solve — the DEFAULT_WORLDS ocean — and the same brains, the same algorithm and the
 * same code produce a ladder that climbs. Both are asserted here, because the contrast IS the
 * lesson the lab teaches.
 *
 * Seeded → deterministic, so these cannot flake. If a change moves them, that is a change to the
 * science: stop and re-measure (`npm run bench:survival`, `scripts/sweep-senses.ts`), never adjust
 * the bands to fit.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { sweep, type SweepStat } from './survival';
import { DEFAULT_WORLDS, REFERENCE_WORLDS } from '../engine';

const SEEDS = Array.from({ length: 8 }, (_, i) => i + 1);
/** The default worlds evolve in 30s generations, so 12 of them is a comparable budget to the
 *  reference's 30 × 10s — and well past convergence either way. */
const DEFAULT_GENERATIONS = 12;
const REFERENCE_GENERATIONS = 30;

let now: Record<string, number>;
let ref: Record<string, number>;

const byName = (stats: SweepStat[]) => Object.fromEntries(stats.map((s) => [s.name, s.meanPct]));

// 120s: two sweeps, and the default worlds' generations are 3× longer than the reference's.
beforeAll(() => {
	// the default bench is judged on LIFE (what selection rewards, and what its tiles plot); the
	// reference bench on the alive-at-the-bell metric it was published with
	now = byName(sweep(DEFAULT_WORLDS, SEEDS, DEFAULT_GENERATIONS, 6, 'life'));
	ref = byName(sweep(REFERENCE_WORLDS, SEEDS, REFERENCE_GENERATIONS, 10, 'alive'));
}, 120_000);

describe('the default bench — an ocean where a sense can pay', () => {
	it('makes direction the biggest single jump on the ladder', () => {
		expect(now['Direction']).toBeGreaterThan(now['Blind drift']);
		expect(now['Direction']).toBeGreaterThan(now['Distance']);
		// and it is a LEAP, not a nudge: this is the sense that earns its keep
		expect(now['Direction'] - now['Distance']).toBeGreaterThan(5);
	});

	it('still shows distance barely beating blindness — the one rung we could never lift', () => {
		// Knowing something is near does not tell you where to go. No ocean we tried changed it,
		// and we did not fake a staircase: this rung stays flat, honestly.
		expect(Math.abs(now['Distance'] - now['Blind drift'])).toBeLessThan(8);
	});

	it('lets the wall sense pay, because nothing here avoids walls for free', () => {
		expect(now['Corner-wise']).toBeGreaterThan(now['Blind drift']);
	});

	it('rewards senses instead of taxing them: the full-sense world beats the blind one outright', () => {
		expect(now['Full senses']).toBeGreaterThan(now['Blind drift']);
	});
});

describe('the reference bench — the ocean where NO sense can pay (the exhibit)', () => {
	it('is the flat band the project was founded on: no dramatic ladder anywhere', () => {
		for (const name of Object.keys(ref)) {
			expect(ref[name]).toBeGreaterThan(15);
			expect(ref[name]).toBeLessThan(55);
		}
	});

	it('never reaches the published §8 figures — they are not reproducible, by the reference either', () => {
		expect(Math.max(...Object.values(ref))).toBeLessThan(50); // §8 claims Direction ~59%
	});

	it('shows extra senses failing to stack — the finding this project was built around', () => {
		// Anticipation (closing) and Corner-wise (walls) pile inputs on top of Direction and buy
		// nothing with them: in THIS ocean neither sense has a danger only it can solve.
		expect(ref['Anticipation']).toBeLessThanOrEqual(ref['Direction'] + 2);
		expect(ref['Corner-wise']).toBeLessThanOrEqual(ref['Direction'] + 2);
	});
});
