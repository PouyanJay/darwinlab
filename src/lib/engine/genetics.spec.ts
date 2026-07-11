import { describe, it, expect } from 'vitest';
import { cloneGenome, crossover, mutate, breed } from './genetics';
import { makeGenome, GLEN } from './network';
import { seededRng } from './rng';
import type { Champion, Genome } from './types';
import { testCfg as cfg } from './testkit';

describe('cloneGenome', () => {
	it('returns an independent equal copy', () => {
		const g = makeGenome(seededRng(1));
		const c = cloneGenome(g);
		expect(c).not.toBe(g);
		expect([...c]).toEqual([...g]);
		c[0] += 1;
		expect(c[0]).not.toBe(g[0]);
	});
});

describe('crossover', () => {
	it('produces a length-68 genome whose genes all come from one parent', () => {
		const a = makeGenome(seededRng(1));
		const b = makeGenome(seededRng(2));
		const child = crossover(a, b, seededRng(9));
		expect(child).toHaveLength(GLEN);
		for (let i = 0; i < GLEN; i++) {
			expect(child[i] === a[i] || child[i] === b[i]).toBe(true);
		}
	});

	it('is reproducible for a given seed', () => {
		const a = makeGenome(seededRng(1));
		const b = makeGenome(seededRng(2));
		expect([...crossover(a, b, seededRng(9))]).toEqual([...crossover(a, b, seededRng(9))]);
	});
});

describe('mutate', () => {
	it('mutates in place, returns the same reference, and changes some genes', () => {
		const g = makeGenome(seededRng(1));
		const before = [...g];
		const out = mutate(g, 0.06, seededRng(3));
		expect(out).toBe(g);
		expect([...g]).not.toEqual(before);
	});

	it('is reproducible for a given seed', () => {
		const run = () => {
			const g = makeGenome(seededRng(1));
			return [...mutate(g, 0.1, seededRng(7))];
		};
		expect(run()).toEqual(run());
	});
});

describe('breed', () => {
	const ranked = (): Genome[] =>
		Array.from({ length: 20 }, (_, i) => makeGenome(seededRng(100 + i)));

	it('returns exactly cfg.prey genomes of full length', () => {
		const roster = ranked().map((genome) => ({ genome }));
		const next = breed(roster, cfg(), null, seededRng(5));
		expect(next).toHaveLength(20);
		expect(next.every((g) => g.length === GLEN)).toBe(true);
	});

	it('places the champion first, copied verbatim', () => {
		const roster = ranked().map((genome) => ({ genome }));
		const champGenome = makeGenome(seededRng(999));
		const champion: Champion = { genome: champGenome, fitness: 42, gen: 3 };
		const next = breed(roster, cfg(), champion, seededRng(5));
		expect([...next[0]]).toEqual([...champGenome]);
		expect(next[0]).not.toBe(champGenome); // a clone, not the same ref
	});

	it('copies the top elites straight through after the champion', () => {
		const roster = ranked().map((genome) => ({ genome }));
		// elite count = round(20 * 0.12) = 2; with no champion they lead the list
		const next = breed(roster, cfg(), null, seededRng(5));
		expect([...next[0]]).toEqual([...roster[0].genome]);
		expect([...next[1]]).toEqual([...roster[1].genome]);
	});

	it('is reproducible for a given seed', () => {
		const roster = ranked().map((genome) => ({ genome }));
		const a = breed(roster, cfg(), null, seededRng(5)).map((g) => [...g]);
		const b = breed(roster, cfg(), null, seededRng(5)).map((g) => [...g]);
		expect(a).toEqual(b);
	});

	it('survives a degenerate single-member roster instead of indexing past the end', () => {
		// The reference floors the tournament window at 2, which would read ranked[1] === undefined
		// and throw. Valid populations are prey >= 2, but the engine must not crash below that.
		const roster = [{ genome: makeGenome(seededRng(1)) }];
		expect(() => breed(roster, cfg({ prey: 1 }), null, seededRng(2))).not.toThrow();
		expect(breed(roster, cfg({ prey: 1 }), null, seededRng(2))).toHaveLength(1);
	});
});
