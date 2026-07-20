import { describe, it, expect } from 'vitest';
import { newWorldConfig } from '../engine';
import { CANDIDATE_CLAIMS, designFor, verdictFrom, type Claim } from './hypothesis';
import type { Contrast } from './stats';

const base = () => newWorldConfig('Base', '#888888');
const claim = (id: string) => CANDIDATE_CLAIMS.find((c) => c.id === id) as Claim;
const ci = (lo: number, hi: number): Contrast => ({ delta: (lo + hi) / 2, ci: { lo, hi }, d: 0 });

describe('designFor', () => {
	it('turns an A>B sense claim into two configs, one per arm', () => {
		const { a, b } = designFor(claim('dir-beats-dist'), base(), {
			seeds: 5,
			episodes: 20,
			bouts: 4
		});
		// arm A is "only direction", arm B is "only distance"
		expect(a.cfg.senses).toEqual({ dist: false, dir: true, closing: false, walls: false });
		expect(b.cfg.senses).toEqual({ dist: true, dir: false, closing: false, walls: false });
		expect(a.seeds).toBe(5);
		expect(b.seeds).toBe(5);
	});

	it('sets both the senses and the predator speed for a cliff claim', () => {
		const { a, b } = designFor(claim('cliff-1'), base(), { seeds: 3, episodes: 10, bouts: 2 });
		expect(a.cfg.predSpeed).toBe(1.0);
		expect(b.cfg.predSpeed).toBe(1.0);
		expect(a.cfg.senses).toEqual({ dist: true, dir: true, closing: true, walls: true }); // all on
		expect(b.cfg.senses).toEqual({ dist: false, dir: false, closing: false, walls: false }); // blind
	});
});

describe('verdictFrom', () => {
	it('A>B is supported only when the interval clears zero in A’s favour', () => {
		expect(verdictFrom(ci(0.4, 1.2), 'A>B')).toBe('supported'); // wholly positive
		expect(verdictFrom(ci(-0.3, 0.9), 'A>B')).toBe('refuted'); // straddles ⇒ not shown
		expect(verdictFrom(ci(-1.2, -0.4), 'A>B')).toBe('refuted'); // B beat A
	});

	it('A≈B is supported only when the interval straddles zero', () => {
		expect(verdictFrom(ci(-0.3, 0.4), 'A≈B')).toBe('supported'); // no difference shown
		expect(verdictFrom(ci(0.4, 1.2), 'A≈B')).toBe('refuted'); // there IS a difference
		expect(verdictFrom(ci(-1.2, -0.4), 'A≈B')).toBe('refuted');
	});

	it('a contrast with no data refutes either kind of claim', () => {
		const noData: Contrast = { delta: NaN, ci: { lo: NaN, hi: NaN }, d: NaN };
		expect(verdictFrom(noData, 'A>B')).toBe('refuted');
		expect(verdictFrom(noData, 'A≈B')).toBe('refuted');
	});
});
