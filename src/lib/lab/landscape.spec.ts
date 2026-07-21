import { describe, it, expect } from 'vitest';
import { newWorldConfig } from '../engine';
import {
	CANDIDATE_AXES,
	expandLandscape,
	planLandscape,
	landscapeJobs,
	landscapeField,
	valueAt,
	steepestFalloff,
	type LandscapeAxis,
	type LandscapeField
} from './landscape';
import type { Evaluation } from './evaluator';

const base = () => newWorldConfig('Base', '#888888');
const axis = (key: string): LandscapeAxis =>
	CANDIDATE_AXES.find((a) => a.key === key) as LandscapeAxis;
/** A fake evaluation carrying just the mean the field reads. */
const evalMean = (meanReturn: number) => ({ meanReturn }) as Evaluation;

describe('expandLandscape', () => {
	it('lays a cols×rows grid whose corners hit the axis min/max', () => {
		const cells = expandLandscape(base(), axis('predSpeed'), axis('mutation'), 3, 3);
		expect(cells).toHaveLength(9);

		// Row-major, index = iy*cols + ix, so the four corners sit at the axis bounds.
		const at = (ix: number, iy: number) => cells.find((c) => c.ix === ix && c.iy === iy)!;
		expect(at(0, 0).x).toBeCloseTo(0.6); // predSpeed min
		expect(at(2, 0).x).toBeCloseTo(1.2); // predSpeed max
		expect(at(0, 0).y).toBeCloseTo(0.01); // mutation min
		expect(at(0, 2).y).toBeCloseTo(0.15); // mutation max
	});

	it("writes BOTH axes onto each cell's config and leaves the rest of the base alone", () => {
		const b = base();
		const cell = expandLandscape(b, axis('predSpeed'), axis('mutation'), 2, 2).find(
			(c) => c.ix === 1 && c.iy === 1
		)!;
		expect(cell.cfg.predSpeed).toBeCloseTo(1.2); // the X axis wrote predSpeed
		expect(cell.cfg.mutation).toBeCloseTo(0.15); // the Y axis wrote mutation
		expect(cell.cfg.vision).toBe(b.vision); // an untouched field is unchanged
	});

	it('snaps integer axes to their real step — even prey, whole predators', () => {
		const preyCells = expandLandscape(base(), axis('prey'), axis('mutation'), 4, 1);
		for (const cell of preyCells) expect(cell.cfg.prey % 2).toBe(0); // prey moves in twos

		const predCells = expandLandscape(base(), axis('preds'), axis('mutation'), 4, 1);
		for (const cell of predCells) expect(Number.isInteger(cell.cfg.preds)).toBe(true);
	});
});

describe('planLandscape + landscapeJobs', () => {
	it('plans a square grid at the given resolution and one job per cell', () => {
		const plan = planLandscape(base(), axis('predSpeed'), axis('mutation'), 5);
		expect(plan.cols).toBe(5);
		expect(plan.rows).toBe(5);
		expect(plan.cells).toHaveLength(25);

		const jobs = landscapeJobs(plan.cells, { seeds: 4, episodes: 18, bouts: 3 });
		expect(jobs).toHaveLength(25);
		// The run size travels onto every job wholesale — seeds AND episodes AND bouts.
		expect(jobs[0]).toMatchObject({ seeds: 4, episodes: 18, bouts: 3 });
		expect(jobs[0].cfg).toBe(plan.cells[0].cfg);
	});
});

describe('landscapeField', () => {
	it('maps results onto cells and takes min/max over the finite ones', () => {
		const plan = planLandscape(base(), axis('predSpeed'), axis('mutation'), 2);
		// four cells; the third failed (null), so its value is NaN and it is excluded from the range
		const results = [evalMean(5), evalMean(9), null, evalMean(2)];
		const field = landscapeField(plan, results);

		expect(field.values[0]).toBeCloseTo(5);
		expect(field.values[1]).toBeCloseTo(9);
		expect(Number.isNaN(field.values[2])).toBe(true);
		expect(field.min).toBeCloseTo(2); // over {5, 9, 2}, not the NaN
		expect(field.max).toBeCloseTo(9);
	});

	it('valueAt reads a cell by grid coordinate', () => {
		const plan = planLandscape(base(), axis('predSpeed'), axis('mutation'), 2);
		const field = landscapeField(plan, [evalMean(1), evalMean(2), evalMean(3), evalMean(4)]);
		expect(valueAt(field, 0, 0)).toBeCloseTo(1);
		expect(valueAt(field, 1, 0)).toBeCloseTo(2);
		expect(valueAt(field, 0, 1)).toBeCloseTo(3);
		expect(valueAt(field, 1, 1)).toBeCloseTo(4);
	});
});

/** Build a field whose columns have the given per-column mean (both rows equal), for the cliff logic. */
function fieldWithColumnMeans(columnMeans: number[]): LandscapeField {
	const cols = columnMeans.length;
	const rows = 2;
	const values: number[] = [];
	for (let iy = 0; iy < rows; iy++) for (let ix = 0; ix < cols; ix++) values.push(columnMeans[ix]);
	const finite = values.filter((v) => Number.isFinite(v));
	return {
		cols,
		rows,
		axisX: axis('predSpeed'),
		axisY: axis('mutation'),
		values,
		min: finite.length ? Math.min(...finite) : 0,
		max: finite.length ? Math.max(...finite) : 0
	};
}

describe('steepestFalloff — the cliff, measured not assumed', () => {
	it('finds the column boundary where survival drops hardest', () => {
		// column means fall off a cliff between columns 1 and 2
		const field = fieldWithColumnMeans([10, 9, 3, 2]);
		const cliff = steepestFalloff(field);
		expect(cliff?.ix).toBe(1); // the drop is between ix 1 and 2
		expect(cliff?.drop).toBeCloseTo(6); // 9 → 3
		// xs = linspace(0.6, 1.2, 4) = [0.6, 0.8, 1.0, 1.2]; midpoint of the pair is 0.9
		expect(cliff?.x).toBeCloseTo(0.9);
	});

	it('returns null when survival never falls along X — no fake cliff on a rising field', () => {
		expect(steepestFalloff(fieldWithColumnMeans([2, 3, 4, 5]))).toBeNull();
	});

	it('skips column pairs with no data rather than reading NaN as a drop', () => {
		// a dead column in the middle; the only real drop is 8 → 1 between columns 2 and 3
		const cliff = steepestFalloff(fieldWithColumnMeans([5, NaN, 8, 1]));
		expect(cliff?.ix).toBe(2);
		expect(cliff?.drop).toBeCloseTo(7);
	});

	it('averages a partially-dead column over its FINITE rows, not down to NaN', () => {
		// col 1 has a single failed cell (row 1). Its column mean must be the surviving row's 4 — so the
		// 10→4 drop is real. Drop the finite-row guard and col 1's mean collapses to NaN, both its drops
		// vanish, and this returns null: this asymmetric case is what distinguishes the guard.
		const field: LandscapeField = {
			cols: 3,
			rows: 2,
			axisX: axis('predSpeed'),
			axisY: axis('mutation'),
			values: [10, 4, 3, 10, NaN, 3], // row 0: 10,4,3 · row 1: 10,NaN,3
			min: 3,
			max: 10
		};
		const cliff = steepestFalloff(field);
		expect(cliff?.ix).toBe(0); // 10 → 4, using col 1's one live cell
		expect(cliff?.drop).toBeCloseTo(6);
	});

	it('returns null for a single-column field — no slope to fall off', () => {
		const field: LandscapeField = {
			cols: 1,
			rows: 3,
			axisX: axis('predSpeed'),
			axisY: axis('mutation'),
			values: [5, 6, 7],
			min: 5,
			max: 7
		};
		expect(steepestFalloff(field)).toBeNull();
	});
});
