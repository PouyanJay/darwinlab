import { describe, it, expect } from 'vitest';
import { newWorldConfig, seededRng } from '../engine';
import {
	BOOL_KNOBS,
	GRADED_KNOBS,
	defaultChoices,
	pinBase,
	sweptFactors,
	expandSweep,
	planSweep,
	sweepJobs,
	sweepEffects,
	type KnobChoices
} from './sweep';
import type { Evaluation } from './evaluator';

const base = () => newWorldConfig('Base', '#888888');

/** Factor fixtures COMPILED from the real catalog — the same door the store uses. */
const boolFactor = (key: string) => sweptFactors({ bools: { [key]: 'sweep' }, graded: {} })[0];
const senseFactor = (key: string) => boolFactor(key);
const predSpeedFactor = sweptFactors({ bools: {}, graded: { predSpeed: [0.6, 0.8, 1.0] } })[0];

/** A stand-in evaluation carrying only the per-seed returns sweepEffects actually reads. */
const withReturns = (returns: number[]) => ({ returns }) as unknown as Evaluation;

describe('expandSweep', () => {
	it('expands the full cross-product of the factors', () => {
		const factors = [senseFactor('dir'), senseFactor('walls'), predSpeedFactor];
		const cells = expandSweep(base(), factors);
		expect(cells).toHaveLength(2 * 2 * 3);
		for (const cell of cells) {
			expect(Object.keys(cell.levels).sort()).toEqual(['dir', 'predSpeed', 'walls']);
		}
	});

	it('applies each level as a real config patch', () => {
		const cells = expandSweep(base(), [senseFactor('dir'), predSpeedFactor]);
		const dirOff = cells.find((cell) => cell.levels.dir === 'off');
		const fast = cells.find((cell) => cell.levels.predSpeed === '1.0×');
		expect(dirOff?.cfg.senses.dir).toBe(false);
		expect(fast?.cfg.predSpeed).toBe(1.0);
	});

	it('is a single empty cell when there are no factors', () => {
		const cells = expandSweep(base(), []);
		expect(cells).toHaveLength(1);
		expect(cells[0].levels).toEqual({});
		expect(sweepEffects([], cells, [null])).toEqual([]); // no factors ⇒ no effects
	});
});

describe('planSweep', () => {
	const fourSensesAndSpeed = [
		senseFactor('dir'),
		senseFactor('dist'),
		senseFactor('walls'),
		senseFactor('closing'),
		predSpeedFactor
	]; // 2×2×2×2×3 = 48 cells

	it('runs the full factorial when it fits under the cap', () => {
		const plan = planSweep(base(), [senseFactor('dir'), senseFactor('walls')], {
			maxCells: 32,
			rng: seededRng(1)
		});
		expect(plan.total).toBe(4);
		expect(plan.sampled).toBe(false);
		expect(plan.cells).toHaveLength(4);
	});

	it('samples a subset over the cap, and reports that it did', () => {
		const plan = planSweep(base(), fourSensesAndSpeed, { maxCells: 10, rng: seededRng(1) });
		expect(plan.total).toBe(48); // the honest full size is kept…
		expect(plan.sampled).toBe(true); // …and it says it did not run all of them
		expect(plan.cells).toHaveLength(10);
	});

	it('samples reproducibly from its seed', () => {
		const opts = () => ({ maxCells: 10, rng: seededRng(3) });
		const a = planSweep(base(), fourSensesAndSpeed, opts()).cells.map((c) => c.levels);
		const b = planSweep(base(), fourSensesAndSpeed, opts()).cells.map((c) => c.levels);
		expect(a).toEqual(b);
	});
});

describe('sweepJobs', () => {
	it('makes one job per cell, carrying its config and the run sizes', () => {
		const cells = expandSweep(base(), [senseFactor('dir')]);
		const jobs = sweepJobs(cells, { seeds: 5, episodes: 20, bouts: 4 });
		expect(jobs).toHaveLength(2);
		expect(jobs[0].seeds).toBe(5);
		expect(jobs[0].episodes).toBe(20);
		expect(jobs.map((job) => job.cfg.senses.dir)).toEqual([false, true]);
	});
});

describe('sweepEffects', () => {
	it('reports a positive effect for a factor whose top level survives longer', () => {
		const factors = [senseFactor('dir')];
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
		const factors = [senseFactor('dir'), senseFactor('walls')];
		const cells = expandSweep(base(), factors); // 4 cells: dir/walls in {off,on}
		// give every dir-on cell returns of 5 and every dir-off cell returns of 3, regardless of walls
		const results = cells.map((cell) => withReturns(cell.levels.dir === 'on' ? [5] : [3]));
		const dir = sweepEffects(factors, cells, results).find((e) => e.key === 'dir');
		expect(dir?.effect.delta).toBeCloseTo(2, 6); // 5 − 3, pooled across both walls settings
	});

	it('skips cells with no result', () => {
		const factors = [senseFactor('dir')];
		const cells = expandSweep(base(), factors);
		const [effect] = sweepEffects(factors, cells, [null, withReturns([4, 4])]);
		expect(effect.effect.delta).toBeNaN(); // the off arm is empty, so there is no contrast
	});
});

describe('the pin-or-sweep knob model', () => {
	/** Choices with everything PINNED to catalog defaults except the overrides given. */
	const pinnedExcept = (over: Partial<KnobChoices> = {}): KnobChoices => ({
		bools: {
			...Object.fromEntries(BOOL_KNOBS.map((k) => [k.key, 'off' as const])),
			...over.bools
		},
		graded: {
			...Object.fromEntries(GRADED_KNOBS.map((k) => [k.key, [k.values[0]]])),
			...over.graded
		}
	});

	it('the default design is the mock’s 48-cell factorial: 2³ bools × 3 speeds × 2 prey sizes', () => {
		const factors = sweptFactors(defaultChoices());
		const cells = factors.reduce((n, f) => n * f.levels.length, 1);
		expect(factors.map((f) => f.key).sort()).toEqual([
			'dir',
			'dist',
			'persistence',
			'predSpeed',
			'preyPct'
		]);
		expect(cells).toBe(48);
	});

	it('pinBase applies pinned booleans and single-chip graded values to every cell’s base', () => {
		const cfg = pinBase(base(), pinnedExcept({ graded: { vision: [240] } }));
		expect(cfg.senses.walls).toBe(false); // pinned off — overriding the generic’s on
		expect(cfg.stamina).toBe(false);
		expect(cfg.vision).toBe(240); // the single chip IS the pin
	});

	it('pinBase leaves swept knobs alone — the factorial owns them', () => {
		const cfg = pinBase(base(), pinnedExcept({ bools: { dir: 'sweep' } }));
		expect(cfg.senses.dir).toBe(base().senses.dir); // untouched, not pinned
	});

	it('a pinned prey % scales the SUBJECT’s base count, floored at a real population', () => {
		const cfg = pinBase({ ...base(), prey: 20 }, pinnedExcept({ graded: { preyPct: [50] } }));
		expect(cfg.prey).toBe(10);
		const tiny = pinBase({ ...base(), prey: 2 }, pinnedExcept({ graded: { preyPct: [50] } }));
		expect(tiny.prey).toBe(2); // never rounds a world down to no fish
	});

	it('swept graded levels sort ascending, so effects read bottom → top', () => {
		const [factor] = sweptFactors({ bools: {}, graded: { predSpeed: [1.1, 0.6, 0.9] } });
		expect(factor.levels.map((l) => l.label)).toEqual(['0.6×', '0.9×', '1.1×']);
		expect(factor.levels[0].apply(base()).predSpeed).toBe(0.6);
	});

	it('one chip is a pin, not a one-level factor', () => {
		expect(sweptFactors({ bools: {}, graded: { predSpeed: [0.8] } })).toEqual([]);
	});

	it('the catalogs’ keys are unique and every default chip is a real offered value', () => {
		const keys = [...BOOL_KNOBS.map((k) => k.key), ...GRADED_KNOBS.map((k) => k.key)];
		expect(new Set(keys).size).toBe(keys.length);
		for (const knob of GRADED_KNOBS) {
			for (const v of knob.defaultSelected) expect(knob.values).toContain(v);
		}
	});
});
