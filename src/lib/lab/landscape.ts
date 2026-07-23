/**
 * The Atlas — a survival landscape over two parameters.
 *
 * Pick two knobs (predator speed, mutation, vision…) and the landscape is a GRID: each cell is the
 * world you get at that (x, y), measured across a few seeds, coloured by how long its fish survive.
 * Where the colour falls off a cliff, a parameter has crossed a threshold that changes the game —
 * the ~0.88× predator-speed cliff, where the shark starts outrunning every fish, is the one this
 * scenario was built to show. The Sweep asks "which knob matters"; the Atlas asks "and WHERE does it
 * flip", and paints the answer as terrain.
 *
 * Pure: an axis is a config PATCH plus a range, so this module knows nothing of the engine beyond
 * WorldConfig and is node-testable without a worker. It samples a UNIFORM grid — no adaptive
 * refinement — because a plain grid is honest about exactly where it looked and never has to explain
 * a hole it decided not to fill.
 */

import type { WorldConfig } from '../engine';
import type { EvalRequest, Evaluation, RunSize } from './evaluator';
import { BOOL_KNOBS } from './sweep';

/**
 * Grid resolution and per-cell run size — a landscape has many cells, so each one is cheaper than a
 * sweep cell. Resolution is a fixed menu (finer costs quadratically, and the panel prices it);
 * training length is editable so a quick look and a careful map are both honest choices.
 */
export const LANDSCAPE_DEFAULTS = {
	resolutions: [5, 7, 9] as const,
	resolution: 7,
	seeds: 4,
	minSeeds: 2,
	maxSeeds: 10,
	episodes: 20,
	minEpisodes: 5,
	maxEpisodes: 60,
	bouts: 3
} as const;

/** One axis of the landscape: a numeric config field, the range it sweeps, and how to write it. */
export interface LandscapeAxis {
	key: string;
	label: string;
	min: number;
	max: number;
	/** Write a value onto a config, rounding to the field's real granularity where it must be integral. */
	apply: (cfg: WorldConfig, value: number) => WorldConfig;
	/** A value formatted for a tick or a tooltip. */
	format: (value: number) => string;
}

/** One sampled point on the plane — a config to evaluate, at grid coordinates (ix, iy). */
export interface LandscapeCell {
	index: number;
	/** Column (X) and row (Y) in the grid. */
	ix: number;
	iy: number;
	/** The axis values this cell sits at. */
	x: number;
	y: number;
	cfg: WorldConfig;
}

/** A landscape sized to run: the grid of cells and the two axes they vary. */
export interface LandscapePlan {
	cells: LandscapeCell[];
	cols: number;
	rows: number;
	axisX: LandscapeAxis;
	axisY: LandscapeAxis;
}

/** A measured landscape: mean survival per cell (row-major), and the range for the colour scale. */
export interface LandscapeField {
	cols: number;
	rows: number;
	axisX: LandscapeAxis;
	axisY: LandscapeAxis;
	/** `values[iy * cols + ix]` — mean seconds survived; NaN where the cell was cancelled or failed. */
	values: number[];
	/** Min/max over the FINITE values — the ends of the colour scale. */
	min: number;
	max: number;
}

/** Where survival falls off most steeply along +X — the cliff, found rather than assumed. */
export interface Falloff {
	/** The left column of the steepest adjacent pair; the drop is between `ix` and `ix + 1`. */
	ix: number;
	/** The X value at the midpoint of that pair — where the annotation is drawn. */
	x: number;
	/** How far mean survival falls across that step, in seconds (always positive). */
	drop: number;
}

/**
 * One numeric axis over a WorldConfig field. The range is a `{ min, max }` object rather than two
 * positional numbers on purpose: two adjacent same-typed args are a silent transposition risk (a
 * swapped pair would paint a backwards axis with no error), and named properties make that a typo you
 * can see. `round` snaps to the field's real step (integers, even prey).
 */
function numericAxis(
	key: keyof WorldConfig & string,
	label: string,
	{ min, max }: { min: number; max: number },
	format: (value: number) => string,
	round: (value: number) => number = (value) => value
): LandscapeAxis {
	return { key, label, min, max, apply: (cfg, value) => ({ ...cfg, [key]: round(value) }), format };
}

/**
 * The axes the predator-prey scenario offers, most-interesting first — the same knob vocabulary as
 * the Sweep's graded set (the mock's call). Predator speed spans the cliff; mutation is the drift
 * knob; vision, top speed, agility and prey reshape the hunt. Each axis's min/max is BOTH its
 * default range and the hard bound an edited range is clamped to.
 */
export const CANDIDATE_AXES: LandscapeAxis[] = [
	numericAxis('predSpeed', 'Predator speed', { min: 0.6, max: 1.4 }, (v) => `${v.toFixed(2)}×`),
	numericAxis('mutation', 'Mutation', { min: 0.02, max: 0.14 }, (v) => v.toFixed(3)),
	numericAxis('vision', 'Vision', { min: 120, max: 280 }, (v) => `${Math.round(v)}px`, Math.round),
	numericAxis(
		'maxSpeed',
		'Top speed',
		{ min: 130, max: 200 },
		(v) => `${Math.round(v)}px/s`,
		Math.round
	),
	numericAxis('agility', 'Agility', { min: 0.8, max: 1.2 }, (v) => `${v.toFixed(2)}×`),
	numericAxis(
		'prey',
		'Prey',
		{ min: 8, max: 40 },
		(v) => `${Math.round(v)} fish`,
		(v) => Math.round(v / 2) * 2
	)
];

/**
 * An axis narrowed to an edited range: clamped into the axis's own bounds, ordered, and — when the
 * edit collapses to a point or inverts into nothing — reset to the full default range rather than
 * planning a zero-width map. Returns a normal LandscapeAxis, so everything downstream (the plan,
 * the field, the ticks, the marginal) works on spans without knowing they were edited.
 */
export function spanAxis(axis: LandscapeAxis, from: number, to: number): LandscapeAxis {
	const clamp = (v: number) => Math.min(axis.max, Math.max(axis.min, v));
	let lo = clamp(Math.min(from, to));
	let hi = clamp(Math.max(from, to));
	if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi - lo < 1e-9) {
		lo = axis.min;
		hi = axis.max;
	}
	return { ...axis, min: lo, max: hi };
}

/** `n` values evenly spaced from `min` to `max` inclusive (just `min` when `n <= 1`). */
function linspace(min: number, max: number, n: number): number[] {
	if (n <= 1) return [min];
	return Array.from({ length: n }, (_, i) => min + ((max - min) * i) / (n - 1));
}

/** The full grid: every (x, y) pair, each a config built by writing both axes onto the base. */
export function expandLandscape(
	base: WorldConfig,
	axisX: LandscapeAxis,
	axisY: LandscapeAxis,
	cols: number,
	rows: number
): LandscapeCell[] {
	const xs = linspace(axisX.min, axisX.max, cols);
	const ys = linspace(axisY.min, axisY.max, rows);
	const cells: LandscapeCell[] = [];
	for (let iy = 0; iy < rows; iy++) {
		for (let ix = 0; ix < cols; ix++) {
			cells.push({
				index: cells.length,
				ix,
				iy,
				x: xs[ix],
				y: ys[iy],
				cfg: axisY.apply(axisX.apply(base, xs[ix]), ys[iy])
			});
		}
	}
	return cells;
}

/** Plan a square landscape at the given resolution — no cap, because a full grid never explodes the way a factorial does. */
export function planLandscape(
	base: WorldConfig,
	axisX: LandscapeAxis,
	axisY: LandscapeAxis,
	resolution: number
): LandscapePlan {
	return {
		cells: expandLandscape(base, axisX, axisY, resolution, resolution),
		cols: resolution,
		rows: resolution,
		axisX,
		axisY
	};
}

/** One evaluation request per cell — the whole grid becomes one batch. */
export function landscapeJobs(cells: LandscapeCell[], size: RunSize): EvalRequest[] {
	return cells.map((cell) => ({ cfg: cell.cfg, ...size }));
}

/** Assemble the field from the batch results, index-aligned with the plan's cells. */
export function landscapeField(
	plan: LandscapePlan,
	results: (Evaluation | null)[]
): LandscapeField {
	const values = plan.cells.map((cell) => results[cell.index]?.meanReturn ?? NaN);
	const finite = values.filter((value) => Number.isFinite(value));
	return {
		cols: plan.cols,
		rows: plan.rows,
		axisX: plan.axisX,
		axisY: plan.axisY,
		values,
		min: finite.length ? Math.min(...finite) : 0,
		max: finite.length ? Math.max(...finite) : 0
	};
}

/** Mean survival at a grid coordinate (NaN where unmeasured). */
export function valueAt(field: LandscapeField, ix: number, iy: number): number {
	return field.values[iy * field.cols + ix];
}

/**
 * Where survival falls off most steeply as X increases — the cliff, MEASURED not hardcoded.
 *
 * Averages each column over its rows, walks the columns, and returns the adjacent pair with the
 * largest DROP. Returns null when survival never falls along X (nothing to annotate) or the grid is
 * too narrow to have a slope — so a flat or rising landscape gets no fake cliff drawn on it.
 */
/** Each column's mean survival, averaged over its FINITE rows (a dead cell must not drag a column to
 *  NaN). Shared by the cliff finder and the Report's X-marginal, so the two can't average differently. */
function columnMeans(field: LandscapeField): number[] {
	return Array.from({ length: field.cols }, (_, ix) => {
		let sum = 0;
		let n = 0;
		for (let iy = 0; iy < field.rows; iy++) {
			const value = field.values[iy * field.cols + ix];
			if (Number.isFinite(value)) {
				sum += value;
				n++;
			}
		}
		return n ? sum / n : NaN;
	});
}

export function steepestFalloff(field: LandscapeField): Falloff | null {
	if (field.cols < 2) return null;

	const means = columnMeans(field);
	const xs = linspace(field.axisX.min, field.axisX.max, field.cols);

	let best: Falloff | null = null;
	for (let ix = 0; ix < field.cols - 1; ix++) {
		const drop = means[ix] - means[ix + 1]; // survival falling as X rises
		if (!Number.isFinite(drop) || drop <= 0) continue;
		if (!best || drop > best.drop) best = { ix, x: (xs[ix] + xs[ix + 1]) / 2, drop };
	}
	return best;
}

/**
 * The field collapsed onto its X axis: each column's mean survival, paired with that column's X value.
 * This is the compact 1-D slice the Report's Q4 strip persists and draws — the whole plane is too much
 * to keep in a finding, but its marginal along the cliff axis is the answer to "where does it break".
 */
export function xMarginal(field: LandscapeField): { x: number; survival: number }[] {
	const xs = linspace(field.axisX.min, field.axisX.max, field.cols);
	const means = columnMeans(field);
	return xs.map((x, ix) => ({ x, survival: means[ix] }));
}

/** The default per-cell run size, as a RunSize the batch spreads onto each request. */
export const LANDSCAPE_RUN: RunSize = {
	seeds: LANDSCAPE_DEFAULTS.seeds,
	episodes: LANDSCAPE_DEFAULTS.episodes,
	bouts: LANDSCAPE_DEFAULTS.bouts
};

/* ================================= the cliff, row by row ====================================== */

/**
 * Each ROW's steepest fall-off along +X — the gold dashes the map traces. Null for a row where
 * survival never falls (a flat or rising row gets no fake cliff), and NaN cells are skipped rather
 * than poisoning their neighbours. The whole-field `steepestFalloff` stays the headline; this is
 * its geometry, made visible cell by cell.
 */
export function rowCliffs(field: LandscapeField): (Falloff | null)[] {
	const xs = linspace(field.axisX.min, field.axisX.max, field.cols);
	return Array.from({ length: field.rows }, (_, iy) => {
		let best: Falloff | null = null;
		for (let ix = 0; ix < field.cols - 1; ix++) {
			const drop = valueAt(field, ix, iy) - valueAt(field, ix + 1, iy);
			if (!Number.isFinite(drop) || drop <= 0) continue;
			if (!best || drop > best.drop) best = { ix, x: (xs[ix] + xs[ix + 1]) / 2, drop };
		}
		return best;
	});
}

/** One row of the field as a curve over X — the cross-section card reads the bottom and top rows,
 *  so the edge's movement along Y is visible as two lines. NaN where a cell was never measured. */
export function rowSection(field: LandscapeField, iy: number): { x: number; survival: number }[] {
	const xs = linspace(field.axisX.min, field.axisX.max, field.cols);
	return xs.map((x, ix) => ({ x, survival: valueAt(field, ix, iy) }));
}

/* ================================== the pinned background ===================================== */

/** The panel's pin sections, in the mock's grouping — each key is a Sweep BOOL_KNOB, reused so a
 *  pin means the same patch in both instruments. Own speed is absent on purpose: it follows the
 *  subject's wiring, and a landscape never varies it. */
export const ATLAS_PIN_GROUPS: { label: string; keys: string[] }[] = [
	{ label: 'Prey senses', keys: ['dir', 'dist', 'walls', 'closing'] },
	{ label: 'Predator', keys: ['persistence', 'lunge', 'lungeCommit'] },
	{ label: 'Body · shoal', keys: ['stamina', 'wallInstinct', 'confusion'] }
];

/** Apply the two-state pins onto the base — the world every cell starts from before the axes write
 *  their values. A key with no explicit pin is left as the base already has it. */
export function pinnedBase(base: WorldConfig, pins: Record<string, boolean>): WorldConfig {
	let cfg = base;
	for (const knob of BOOL_KNOBS) {
		if (knob.key in pins) cfg = knob.apply(cfg, pins[knob.key]);
	}
	return cfg;
}

/* ===================================== the CSV export ========================================= */

/** Escape one CSV field — quotes doubled, wrapped when the text needs it. */
function csvField(value: string | number): string {
	const text = String(value);
	return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The measured landscape as CSV, one row per cell: grid coordinates, both axis values, and the mean
 * survival. The header carries the design — axes with their (possibly edited) ranges, resolution,
 * seeds and training length — so a file on someone's disk still says how it was measured.
 */
export function landscapeCsv(
	field: LandscapeField,
	receipt: { seeds: number; episodes: number }
): string {
	const xs = linspace(field.axisX.min, field.axisX.max, field.cols);
	const ys = linspace(field.axisY.min, field.axisY.max, field.rows);
	const meta =
		`# darwinlab atlas · ${field.axisX.label} ${field.axisX.format(field.axisX.min)}→${field.axisX.format(field.axisX.max)}` +
		` × ${field.axisY.label} ${field.axisY.format(field.axisY.min)}→${field.axisY.format(field.axisY.max)}` +
		` · ${field.cols}×${field.rows} cells · ${receipt.seeds} seeds · ${receipt.episodes} gens`;
	const header = ['ix', 'iy', field.axisX.label, field.axisY.label, 'mean_s'];
	const rows: (string | number)[][] = [];
	for (let iy = 0; iy < field.rows; iy++) {
		for (let ix = 0; ix < field.cols; ix++) {
			const value = valueAt(field, ix, iy);
			rows.push([ix, iy, xs[ix], ys[iy], Number.isFinite(value) ? value.toFixed(3) : '']);
		}
	}
	return [meta, header.map(csvField).join(','), ...rows.map((r) => r.map(csvField).join(','))].join(
		'\n'
	);
}
