import { describe, it, expect } from 'vitest';
import { rankEffectRows, strongestEffect, type EffectRow } from './evidence';

const row = (label: string, delta: number, lo: number, hi: number): EffectRow => ({
	label,
	delta,
	lo,
	hi
});

describe('rankEffectRows', () => {
	it('ranks by effect size, largest first, regardless of sign', () => {
		const ranked = rankEffectRows([
			row('small', 0.3, 0.1, 0.5),
			row('bigCost', -2.8, -3.5, -2.1),
			row('mid', 1.9, 1.2, 2.6)
		]);
		expect(ranked.map((r) => r.label)).toEqual(['bigCost', 'mid', 'small']);
	});

	it('sinks NaN arms to the bottom instead of poisoning the sort', () => {
		const ranked = rankEffectRows([row('empty', NaN, NaN, NaN), row('real', 0.2, 0.1, 0.3)]);
		expect(ranked.map((r) => r.label)).toEqual(['real', 'empty']);
	});

	it('returns a new array — the input order is untouched', () => {
		const rows = [row('a', 0.1, 0, 0.2), row('b', 2, 1, 3)];
		const ranked = rankEffectRows(rows);
		expect(ranked).not.toBe(rows);
		expect(rows.map((r) => r.label)).toEqual(['a', 'b']);
	});
});

describe('strongestEffect', () => {
	it('picks the largest effect whose interval clears zero', () => {
		const winner = strongestEffect([
			row('huge but flat', 5, -1, 11), // straddles zero — not a finding
			row('real', -1.4, -2.0, -0.8),
			row('smaller real', 0.9, 0.2, 1.6)
		]);
		expect(winner?.label).toBe('real');
	});

	it('returns null when nothing clears zero — a flat environment is a real result', () => {
		expect(strongestEffect([row('flat', 0.6, -0.1, 1.3)])).toBeNull();
		expect(strongestEffect([])).toBeNull();
	});
});
