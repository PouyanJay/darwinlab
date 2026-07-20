import { describe, it, expect } from 'vitest';
import { newWorldConfig, seededRng } from '../engine';
import {
	senseFactor,
	CANDIDATE_FACTORS,
	expandSweep,
	planSweep,
	sweepJobs,
	sweepEffects
} from './sweep';
import type { Evaluation } from './evaluator';

const base = () => newWorldConfig('Base', '#888888');
const predSpeedFactor = CANDIDATE_FACTORS.find((f) => f.key === 'predSpeed')!;

/** A stand-in evaluation carrying only the per-seed returns sweepEffects actually reads. */
const withReturns = (returns: number[]) => ({ returns }) as unknown as Evaluation;

describe('expandSweep', () => {
	it('expands the full cross-product of the factors', () => {
		const factors = [
			senseFactor('dir', 'Direction'),
			senseFactor('walls', 'Walls'),
			predSpeedFactor
		];
		const cells = expandSweep(base(), factors);
		expect(cells).toHaveLength(2 * 2 * 3);
		for (const cell of cells) {
			expect(Object.keys(cell.levels).sort()).toEqual(['dir', 'predSpeed', 'walls']);
		}
	});

	it('applies each level as a real config patch', () => {
		const cells = expandSweep(base(), [senseFactor('dir', 'Direction'), predSpeedFactor]);
		const dirOff = cells.find((cell) => cell.levels.dir === 'off');
		const fast = cells.find((cell) => cell.levels.predSpeed === '1.0×');
		expect(dirOff?.cfg.senses.dir).toBe(false);
		expect(fast?.cfg.predSpeed).toBe(1.0);
	});
});

describe('planSweep', () => {
	const fourSensesAndSpeed = [
		senseFactor('dir', 'Direction'),
		senseFactor('dist', 'Distance'),
		senseFactor('walls', 'Walls'),
		senseFactor('closing', 'Closing'),
		predSpeedFactor
	]; // 2×2×2×2×3 = 48 cells

	it('runs the full factorial when it fits under the cap', () => {
		const plan = planSweep(
			base(),
			[senseFactor('dir', 'Direction'), senseFactor('walls', 'Walls')],
			32,
			seededRng(1)
		);
		expect(plan.total).toBe(4);
		expect(plan.sampled).toBe(false);
		expect(plan.cells).toHaveLength(4);
	});

	it('samples a subset over the cap, and reports that it did', () => {
		const plan = planSweep(base(), fourSensesAndSpeed, 10, seededRng(1));
		expect(plan.total).toBe(48); // the honest full size is kept…
		expect(plan.sampled).toBe(true); // …and it says it did not run all of them
		expect(plan.cells).toHaveLength(10);
	});

	it('samples reproducibly from its seed', () => {
		const a = planSweep(base(), fourSensesAndSpeed, 10, seededRng(3)).cells.map((c) => c.levels);
		const b = planSweep(base(), fourSensesAndSpeed, 10, seededRng(3)).cells.map((c) => c.levels);
		expect(a).toEqual(b);
	});
});

describe('sweepJobs', () => {
	it('makes one job per cell, carrying its config and the run sizes', () => {
		const cells = expandSweep(base(), [senseFactor('dir', 'Direction')]);
		const jobs = sweepJobs(cells, 5, 20, 4);
		expect(jobs).toHaveLength(2);
		expect(jobs[0].seeds).toBe(5);
		expect(jobs[0].episodes).toBe(20);
		expect(jobs.map((job) => job.cfg.senses.dir)).toEqual([false, true]);
	});
});

describe('sweepEffects', () => {
	it('reports a positive effect for a factor whose top level survives longer', () => {
		const factors = [senseFactor('dir', 'Direction')];
		const cells = expandSweep(base(), factors); // [dir off, dir on]
		const results = [withReturns([3, 3, 3]), withReturns([4, 4, 4])];
		const [effect] = sweepEffects(factors, cells, results);

		expect(effect.key).toBe('dir');
		expect(effect.from).toBe('off');
		expect(effect.to).toBe('on');
		expect(effect.effect.delta).toBeCloseTo(1, 6); // on(4) − off(3)
		expect(effect.effect.ci.lo).toBeGreaterThan(0); // the whole interval clears zero
	});

	it('marginalises over the other factors when pooling a level', () => {
		// dir × walls: dir's effect should pool BOTH walls settings into each dir arm.
		const factors = [senseFactor('dir', 'Direction'), senseFactor('walls', 'Walls')];
		const cells = expandSweep(base(), factors); // 4 cells: dir/walls in {off,on}
		// give every dir-on cell returns of 5 and every dir-off cell returns of 3, regardless of walls
		const results = cells.map((cell) => withReturns(cell.levels.dir === 'on' ? [5] : [3]));
		const dir = sweepEffects(factors, cells, results).find((e) => e.key === 'dir');
		expect(dir?.effect.delta).toBeCloseTo(2, 6); // 5 − 3, pooled across both walls settings
	});

	it('skips cells with no result', () => {
		const factors = [senseFactor('dir', 'Direction')];
		const cells = expandSweep(base(), factors);
		const [effect] = sweepEffects(factors, cells, [null, withReturns([4, 4])]);
		expect(effect.effect.delta).toBeNaN(); // the off arm is empty, so there is no contrast
	});
});
