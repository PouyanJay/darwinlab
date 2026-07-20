import { describe, it, expect } from 'vitest';
import { seededRng } from '../engine';
import { mean, stdev, cohensD, bootstrapCI, contrast } from './stats';

/**
 * These are the numbers a Research conclusion is built from, so they are pinned to values worked out
 * by hand, not to whatever the code happens to return. The bootstrap tests lean on the seeded rng:
 * the same data must yield the same interval, or "reproducible" is a lie.
 */
describe('mean and stdev', () => {
	it('mean averages the sample', () => {
		expect(mean([1, 2, 3, 4])).toBe(2.5);
	});

	it('stdev is the population standard deviation', () => {
		// the textbook example: mean 5, squared deviations sum to 32 over 8 ⇒ variance 4 ⇒ sd 2
		expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
	});

	it('an empty sample has no mean or spread', () => {
		expect(mean([])).toBeNaN();
		expect(stdev([])).toBeNaN();
	});
});

describe('cohensD', () => {
	it('measures separation in pooled-sd units', () => {
		// a: mean 3, sample var 2.5; b: mean 5, sample var 2.5 ⇒ pooled sd √2.5 ⇒ d = −2/√2.5
		const d = cohensD([1, 2, 3, 4, 5], [3, 4, 5, 6, 7]);
		expect(d).toBeCloseTo(-2 / Math.sqrt(2.5), 6);
	});

	it('is zero when the two samples are identical', () => {
		expect(cohensD([4, 4, 4], [4, 4, 4])).toBe(0);
	});

	it('is signed by which arm is larger', () => {
		expect(cohensD([9, 10, 11], [1, 2, 3])).toBeGreaterThan(0);
	});
});

describe('bootstrapCI', () => {
	it('collapses to the value when the sample has no variation', () => {
		expect(bootstrapCI([5, 5, 5, 5])).toEqual({ lo: 5, hi: 5 });
	});

	it('brackets the sample mean', () => {
		const xs = [3, 4, 4, 5, 6, 4, 5];
		const { lo, hi } = bootstrapCI(xs);
		expect(lo).toBeLessThanOrEqual(mean(xs));
		expect(hi).toBeGreaterThanOrEqual(mean(xs));
	});

	it('is reproducible: the same data and seed give the same interval', () => {
		const xs = [2, 5, 3, 8, 4, 6];
		const a = bootstrapCI(xs, { rng: seededRng(7) });
		const b = bootstrapCI(xs, { rng: seededRng(7) });
		expect(a).toEqual(b);
	});
});

describe('contrast', () => {
	it('reports the difference of means and a bootstrap interval that clears zero when the arms separate', () => {
		const withDirection = [4.2, 4.5, 4.4, 4.6, 4.3];
		const distanceOnly = [3.2, 3.4, 3.3, 3.1, 3.5];
		const { delta, ci, d } = contrast(withDirection, distanceOnly);

		expect(delta).toBeCloseTo(mean(withDirection) - mean(distanceOnly), 6);
		expect(ci.lo).toBeGreaterThan(0); // the whole interval is above zero — a real difference
		expect(d).toBeGreaterThan(0);
	});

	it('leaves an interval that spans zero when the arms overlap', () => {
		const a = [3, 4, 5, 3, 4];
		const b = [4, 3, 5, 4, 3];
		const { ci } = contrast(a, b);
		expect(ci.lo).toBeLessThan(0);
		expect(ci.hi).toBeGreaterThan(0);
	});
});
