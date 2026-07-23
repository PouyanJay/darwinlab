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
	xMarginal,
	spanAxis,
	rowCliffs,
	rowSection,
	pinnedBase,
	landscapeCsv,
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
		const cells = expandLandscape(
			{ base: base(), axisX: axis('predSpeed'), axisY: axis('mutation') },
			3,
			3
		);
		expect(cells).toHaveLength(9);

		// Row-major, index = iy*cols + ix, so the four corners sit at the axis bounds.
		const at = (ix: number, iy: number) => cells.find((c) => c.ix === ix && c.iy === iy)!;
		expect(at(0, 0).x).toBeCloseTo(0.6); // predSpeed min
		expect(at(2, 0).x).toBeCloseTo(1.4); // predSpeed max
		expect(at(0, 0).y).toBeCloseTo(0.02); // mutation min
		expect(at(0, 2).y).toBeCloseTo(0.14); // mutation max
	});

	it("writes BOTH axes onto each cell's config and leaves the rest of the base alone", () => {
		const b = base();
		const cell = expandLandscape(
			{ base: b, axisX: axis('predSpeed'), axisY: axis('mutation') },
			2,
			2
		).find((c) => c.ix === 1 && c.iy === 1)!;
		expect(cell.cfg.predSpeed).toBeCloseTo(1.4); // the X axis wrote predSpeed
		expect(cell.cfg.mutation).toBeCloseTo(0.14); // the Y axis wrote mutation
		expect(cell.cfg.vision).toBe(b.vision); // an untouched field is unchanged
	});

	it('snaps integer axes to their real step — even prey, whole pixels of top speed', () => {
		const preyCells = expandLandscape(
			{ base: base(), axisX: axis('prey'), axisY: axis('mutation') },
			4,
			1
		);
		for (const cell of preyCells) expect(cell.cfg.prey % 2).toBe(0); // prey moves in twos

		const speedCells = expandLandscape(
			{ base: base(), axisX: axis('maxSpeed'), axisY: axis('mutation') },
			4,
			1
		);
		for (const cell of speedCells) expect(Number.isInteger(cell.cfg.maxSpeed)).toBe(true);
	});
});

describe('planLandscape + landscapeJobs', () => {
	it('plans a square grid at the given resolution and one job per cell', () => {
		const plan = planLandscape(
			{ base: base(), axisX: axis('predSpeed'), axisY: axis('mutation') },
			5
		);
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
		const plan = planLandscape(
			{ base: base(), axisX: axis('predSpeed'), axisY: axis('mutation') },
			2
		);
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
		const plan = planLandscape(
			{ base: base(), axisX: axis('predSpeed'), axisY: axis('mutation') },
			2
		);
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

describe('xMarginal — the field collapsed onto its X axis for the Report strip', () => {
	it('pairs each column mean with its X value, in axis order', () => {
		// column means [10, 6, 3, 2]; xs = linspace(0.6, 1.4, 4) ends at the axis bounds
		const band = xMarginal(fieldWithColumnMeans([10, 6, 3, 2]));

		expect(band).toHaveLength(4);
		expect(band.map((b) => b.survival)).toEqual([10, 6, 3, 2]);
		expect(band[0].x).toBeCloseTo(0.6);
		expect(band[3].x).toBeCloseTo(1.4);
	});

	it('averages a column over its FINITE rows, not down to NaN', () => {
		// col 1 has one dead cell; its marginal is the surviving row's value, not NaN
		const field: LandscapeField = {
			cols: 2,
			rows: 2,
			axisX: axis('predSpeed'),
			axisY: axis('mutation'),
			values: [10, 4, 10, NaN], // col 0: 10,10 · col 1: 4,NaN
			min: 4,
			max: 10
		};
		expect(xMarginal(field).map((b) => b.survival)).toEqual([10, 4]);
	});
});

describe('steepestFalloff — the cliff, measured not assumed', () => {
	it('finds the column boundary where survival drops hardest', () => {
		// column means fall off a cliff between columns 1 and 2
		const field = fieldWithColumnMeans([10, 9, 3, 2]);
		const cliff = steepestFalloff(field);
		expect(cliff?.ix).toBe(1); // the drop is between ix 1 and 2
		expect(cliff?.drop).toBeCloseTo(6); // 9 → 3
		// xs = linspace(0.6, 1.4, 4); the midpoint of columns 1..2 is (0.867 + 1.133) / 2
		expect(cliff?.x).toBeCloseTo(1.0);
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

describe('spanAxis — an edited range, made legal', () => {
	it('clamps into the axis bounds and orders an inverted pair', () => {
		const spanned = spanAxis(axis('predSpeed'), 1.9, 0.3);
		expect(spanned.min).toBeCloseTo(0.6); // clamped up to the axis bound
		expect(spanned.max).toBeCloseTo(1.4); // clamped down, and the pair ordered
	});

	it('keeps a legal sub-range as given', () => {
		const spanned = spanAxis(axis('predSpeed'), 0.8, 1.1);
		expect(spanned.min).toBeCloseTo(0.8);
		expect(spanned.max).toBeCloseTo(1.1);
	});

	it('resets a collapsed or non-finite range to the axis defaults, never a zero-width map', () => {
		const collapsed = spanAxis(axis('mutation'), 0.06, 0.06);
		expect(collapsed.min).toBeCloseTo(0.02);
		expect(collapsed.max).toBeCloseTo(0.14);
		const garbage = spanAxis(axis('mutation'), NaN, 0.1);
		expect(garbage.min).toBeCloseTo(0.02);
		expect(garbage.max).toBeCloseTo(0.14);
	});

	it('everything downstream reads the span — a plan over it hits the edited corners', () => {
		const cells = expandLandscape(
			{ base: base(), axisX: spanAxis(axis('predSpeed'), 0.8, 1.0), axisY: axis('mutation') },
			3,
			1
		);
		expect(cells[0].x).toBeCloseTo(0.8);
		expect(cells[2].x).toBeCloseTo(1.0);
	});
});

describe('rowCliffs — the cliff, traced row by row', () => {
	it('finds each row its own steepest drop, so the edge can bend', () => {
		// row 0 falls between columns 1→2; row 1 falls earlier, between 0→1 — the edge moved left
		const field: LandscapeField = {
			cols: 3,
			rows: 2,
			axisX: axis('predSpeed'),
			axisY: axis('mutation'),
			values: [8, 7, 2, 8, 3, 2], // row 0: 8,7,2 · row 1: 8,3,2
			min: 2,
			max: 8
		};
		const cliffs = rowCliffs(field);
		expect(cliffs[0]?.ix).toBe(1);
		expect(cliffs[0]?.drop).toBeCloseTo(5);
		expect(cliffs[1]?.ix).toBe(0);
		expect(cliffs[1]?.drop).toBeCloseTo(5);
	});

	it('leaves a flat or rising row untraced — no fake cliff', () => {
		const field: LandscapeField = {
			cols: 3,
			rows: 2,
			axisX: axis('predSpeed'),
			axisY: axis('mutation'),
			values: [2, 3, 4, 5, 5, 5], // row 0 rises, row 1 is flat
			min: 2,
			max: 5
		};
		expect(rowCliffs(field)).toEqual([null, null]);
	});

	it('skips NaN neighbours rather than reading them as drops', () => {
		const field: LandscapeField = {
			cols: 3,
			rows: 1,
			axisX: axis('predSpeed'),
			axisY: axis('mutation'),
			values: [9, NaN, 2],
			min: 2,
			max: 9
		};
		expect(rowCliffs(field)).toEqual([null]); // both pairs touch the dead cell
	});
});

describe('rowSection — one row of the map as a curve', () => {
	it('pairs each cell with its X value, for the given row', () => {
		const field = fieldWithColumnMeans([10, 6, 3, 2]); // both rows equal
		const section = rowSection(field, 1);
		expect(section.map((p) => p.survival)).toEqual([10, 6, 3, 2]);
		expect(section[0].x).toBeCloseTo(0.6);
		expect(section[3].x).toBeCloseTo(1.4);
	});
});

describe('pinnedBase — the two-state background, compiled', () => {
	it('applies explicit pins through the Sweep knob catalog and leaves unpinned keys alone', () => {
		const cfg = pinnedBase(base(), { persistence: true, dir: false });
		expect(cfg.persistence).toBe(true); // the pin reached the config
		expect(cfg.senses.dir).toBe(false); // a sense pin goes through the same catalog
		expect(cfg.senses.dist).toBe(base().senses.dist); // an unpinned key is untouched
	});

	it('ignores a key no knob owns rather than guessing a patch', () => {
		expect(pinnedBase(base(), { sonar: true }).senses).toEqual(base().senses);
	});
});

describe('landscapeCsv', () => {
	it('carries the design in the header and one row per cell', () => {
		const plan = planLandscape(
			{ base: base(), axisX: axis('predSpeed'), axisY: axis('mutation') },
			2
		);
		const field = landscapeField(plan, [evalMean(1), evalMean(2), null, evalMean(4)]);
		const csv = landscapeCsv(field, { seeds: 4, episodes: 20 });
		const lines = csv.split('\n');
		expect(lines[0]).toContain('2×2 cells · 4 seeds · 20 gens'); // the receipt travels
		expect(lines[0]).toContain('Predator speed');
		expect(lines).toHaveLength(2 + 4); // meta + header + one line per cell
		expect(lines[2]).toMatch(/^0,0,0.6,0.02,1.000$/); // ix, iy, x, y, mean
		expect(lines[4].endsWith(',')).toBe(true); // the failed cell exports empty, not NaN
	});
});
