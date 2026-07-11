/**
 * The honest finding, as an executable test.
 *
 * Seeded → fully deterministic, so these assertions cannot flake. They encode what the engine
 * ACTUALLY does (verified bit-for-bit against the reference in fidelity.spec.ts), not what the
 * handoff README §8 claims it does.
 *
 * If a change to the engine moves these numbers, that is a change to the science — stop and
 * re-measure (`npm run bench:survival`), do not adjust the bands to fit.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { sweep, type SweepStat } from './survival';
import { DEFAULT_WORLDS } from '../engine';

const SEEDS = Array.from({ length: 8 }, (_, i) => i + 1);
const GENERATIONS = 30;

// Run the sweep in a hook, not at module scope: a throw here must surface as a failing test,
// not an opaque collection error, and it must not run when filtering to an unrelated test.
let stats: SweepStat[];
let by: Record<string, number>;

beforeAll(() => {
	stats = sweep(DEFAULT_WORLDS, SEEDS, GENERATIONS, 10);
	by = Object.fromEntries(stats.map((s) => [s.name, s.meanPct]));
});

describe('converged survival (the honest finding)', () => {
	it('lands every world in a flat ~20–50% band — there is no dramatic sense ladder', () => {
		for (const s of stats) {
			expect(s.meanPct).toBeGreaterThan(20);
			expect(s.meanPct).toBeLessThan(50);
		}
	});

	it('makes Direction the only sense that clearly pays', () => {
		expect(by['Direction']).toBeGreaterThan(by['Blind drift']);
		expect(by['Direction']).toBeGreaterThan(by['Distance']);
	});

	it('shows extra senses do NOT stack on top of Direction', () => {
		expect(by['Anticipation']).toBeLessThanOrEqual(by['Direction']);
		expect(by['Corner-wise']).toBeLessThanOrEqual(by['Direction']);
	});

	it('shows Distance alone barely beats sensing nothing at all', () => {
		expect(by['Distance'] - by['Blind drift']).toBeLessThan(8);
	});

	it('never reaches the published §8 figures (they are not reproducible from this engine)', () => {
		// §8 claims Direction ~59%. The reference engine itself does not get there either.
		expect(by['Direction']).toBeLessThan(50);
		expect(Math.max(...stats.map((s) => s.meanPct))).toBeLessThan(50);
	});
});
