/**
 * The drift watch's own guard, spec'd with synthetic stats (no sweep — that lives in
 * survival.spec.ts and is slow). The nightly bench can only prove this logic fires by
 * running for hours with a genuinely drifted engine; these tests make its failure modes
 * cheap to see — including the one that shipped: a world missing from the baseline table
 * compared as NaN and was silently exempt from the watch.
 */

import { describe, it, expect } from 'vitest';
import { findDrift, type SweepStat } from './survival';

const stat = (name: string, meanPct: number): SweepStat => ({
	name,
	meanPct,
	stdPct: 0,
	valuesPct: [meanPct]
});

const BASELINES = { 'Blind drift': 31, Direction: 36 };

describe('findDrift', () => {
	it('reports nothing when every world sits within tolerance', () => {
		const stats = [stat('Blind drift', 33.5), stat('Direction', 34)];
		expect(findDrift(stats, BASELINES, 5)).toEqual([]);
	});

	it('flags a world beyond tolerance, in either direction', () => {
		const up = stat('Blind drift', 37);
		const down = stat('Direction', 30);
		expect(findDrift([up, down], BASELINES, 5)).toEqual([up, down]);
	});

	it('treats exactly-at-tolerance as NOT drifted (the gate is >, not >=)', () => {
		const stats = [stat('Direction', 41)];
		expect(findDrift(stats, BASELINES, 5)).toEqual([]);
	});

	it('throws for a world with no baseline instead of silently exempting it', () => {
		// The NaN hole: meanPct - undefined is NaN, NaN > tolerance is false — without the
		// guard, a renamed or added world could drift forever and the watch would stay green.
		const stats = [stat('Corner sense', 99)];
		expect(() => findDrift(stats, BASELINES, 5)).toThrowError(/Corner sense/);
	});
});
