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
	sweepInteractions,
	interactionPlotData,
	isUnderTrained,
	levelCurves,
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

describe('sweepInteractions (P4)', () => {
	const dirFactor = () => boolFactor('dir');
	const wallsFactor = () => boolFactor('walls');

	/** A 2×2 grid whose returns follow a chosen rule per cell — the interaction is constructed. */
	const gridWith = (value: (dir: string, walls: string) => number[]) => {
		const factors = [dirFactor(), wallsFactor()];
		const cells = expandSweep(base(), factors);
		const results = cells.map((cell) => withReturns(value(cell.levels.dir, cell.levels.walls)));
		return { factors, cells, results };
	};

	it('finds a constructed interaction — A pays only when B is on', () => {
		// dir is worth +4 with walls on, worth 0 with walls off → interaction = +4.
		const { factors, cells, results } = gridWith((dir, walls) =>
			dir === 'on' && walls === 'on' ? [8, 8, 8] : [4, 4, 4]
		);
		const [pair] = sweepInteractions(factors, cells, results);
		expect(pair.label).toBe('Direction × Walls');
		expect(pair.effect.delta).toBeCloseTo(4, 6);
		expect(pair.effect.ci.lo).toBeGreaterThan(0); // the interval clears zero — a real interaction
	});

	it('reports parallel lines as no interaction', () => {
		// dir is worth +2 regardless of walls — additive, no interaction.
		const { factors, cells, results } = gridWith((dir) => (dir === 'on' ? [6, 6, 6] : [4, 4, 4]));
		const [pair] = sweepInteractions(factors, cells, results);
		expect(pair.effect.delta).toBeCloseTo(0, 6);
	});

	it('tests every unordered pair exactly once', () => {
		const factors = [dirFactor(), wallsFactor(), boolFactor('stamina')];
		const cells = expandSweep(base(), factors);
		const results = cells.map(() => withReturns([5]));
		const pairs = sweepInteractions(factors, cells, results);
		expect(pairs.map((p) => p.label).sort()).toEqual([
			'Direction × Stamina',
			'Direction × Walls',
			'Walls × Stamina' // pair labels keep FACTOR order, not alphabetical
		]);
	});

	it('an empty arm yields an honest NaN, not a number in costume', () => {
		const factors = [dirFactor(), wallsFactor()];
		const cells = expandSweep(base(), factors);
		const results = cells.map((cell, i) => (i === 0 ? null : withReturns([5])));
		const [pair] = sweepInteractions(factors, cells, results);
		expect(pair.effect.delta).toBeNaN();
	});

	it('drops the trailing unit mark from a pair label', () => {
		const speed = sweptFactors({ bools: {}, graded: { predSpeed: [0.6, 1.0] } })[0];
		const pairs = sweepInteractions([boolFactor('dir'), speed], [], []);
		expect(pairs[0].label).toBe('Direction × Predator speed');
	});
});

describe('interactionPlotData (P4)', () => {
	it('gives one series per B extreme across all of A’s levels', () => {
		const a = sweptFactors({ bools: {}, graded: { predSpeed: [0.6, 0.8, 1.0] } })[0];
		const b = boolFactor('dir');
		const cells = expandSweep(base(), [a, b]);
		// survival falls with speed; dir-on halves the fall
		const results = cells.map((cell) => {
			const speed = Number(cell.levels.predSpeed.replace('×', ''));
			const on = cell.levels.dir === 'on';
			return withReturns([8 - (on ? 2 : 4) * speed]);
		});
		const plot = interactionPlotData(a, b, cells, results);
		expect(plot.x).toEqual(['0.6×', '0.8×', '1.0×']);
		expect(plot.bottom).toHaveLength(3); // dir off series
		expect(plot.top?.[0]).toBeCloseTo(8 - 2 * 0.6, 6);
		expect(plot.bottom?.[2]).toBeCloseTo(8 - 4 * 1.0, 6);
	});
});

describe('isUnderTrained (P4)', () => {
	it('flags a curve still climbing at its end', () => {
		const climbing = Array.from({ length: 24 }, (_, i) => 0.2 + i * 0.02); // straight line up
		expect(isUnderTrained(climbing)).toBe(true);
	});

	it('passes a curve that has plateaued', () => {
		const saturating = Array.from({ length: 24 }, (_, i) => 0.7 - 0.5 * Math.exp(-i / 4));
		expect(isUnderTrained(saturating)).toBe(false);
	});

	it('never cries wolf on a flat or short curve', () => {
		expect(isUnderTrained(Array(24).fill(0.4))).toBe(false); // flat — nothing was learned
		expect(isUnderTrained([0.2, 0.3, 0.4])).toBe(false); // too short to judge
	});
});

describe('levelCurves (P4)', () => {
	it('averages each arm’s curves and keeps the arms apart', () => {
		const factor = boolFactor('dir');
		const cells = expandSweep(base(), [factor]);
		const results = cells.map((cell) => ({
			...withReturns([5]),
			curve: cell.levels.dir === 'on' ? [0.2, 0.6] : [0.2, 0.4]
		}));
		const arms = levelCurves(factor, cells, results as (Evaluation | null)[]);
		expect(arms.to).toEqual([0.2, 0.6]);
		expect(arms.from).toEqual([0.2, 0.4]);
	});

	it('is empty when the run captured no curves', () => {
		const factor = boolFactor('dir');
		const cells = expandSweep(base(), [factor]);
		const arms = levelCurves(
			factor,
			cells,
			cells.map(() => withReturns([5]))
		);
		expect(arms.from).toEqual([]);
		expect(arms.to).toEqual([]);
	});
});

describe('sweepJobs (P4 flags)', () => {
	it('always captures curves, and carries the champion flag only when asked', () => {
		const cells = expandSweep(base(), [boolFactor('dir')]);
		const plain = sweepJobs(cells, { seeds: 2, episodes: 5, bouts: 2 });
		expect(plain.every((job) => job.curve === true)).toBe(true);
		expect(plain.every((job) => job.champion === false)).toBe(true);
		const live = sweepJobs(cells, { seeds: 2, episodes: 5, bouts: 2 }, { champion: true });
		expect(live.every((job) => job.champion === true)).toBe(true);
	});
});
