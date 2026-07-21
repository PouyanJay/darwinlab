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

/** Grid resolution and per-cell run size — a landscape has many cells, so each one is cheaper than a sweep cell. */
export const LANDSCAPE_DEFAULTS = {
	resolution: 6,
	minRes: 3,
	maxRes: 8,
	seeds: 4,
	minSeeds: 2,
	maxSeeds: 8,
	episodes: 18,
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
 * The axes the predator-prey scenario offers, most-interesting first. Predator speed spans the 0.88
 * cliff; mutation is the drift knob; vision, prey and predators reshape the hunt. Ranges are sub-
 * ranges of what the Conditions dialog allows — chosen to sit the interesting region inside the grid.
 */
export const CANDIDATE_AXES: LandscapeAxis[] = [
	numericAxis('predSpeed', 'Predator speed', { min: 0.6, max: 1.2 }, (v) => `${v.toFixed(2)}×`),
	numericAxis('mutation', 'Mutation', { min: 0.01, max: 0.15 }, (v) => v.toFixed(3)),
	numericAxis('vision', 'Vision', { min: 120, max: 280 }, (v) => `${Math.round(v)}px`, Math.round),
	numericAxis(
		'prey',
		'Prey',
		{ min: 8, max: 40 },
		(v) => `${Math.round(v)}`,
		(v) => Math.round(v / 2) * 2
	),
	numericAxis('preds', 'Predators', { min: 1, max: 5 }, (v) => `${Math.round(v)}`, Math.round)
];

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
export function steepestFalloff(field: LandscapeField): Falloff | null {
	if (field.cols < 2) return null;

	const columnMean = (ix: number): number => {
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
	};

	const means = Array.from({ length: field.cols }, (_, ix) => columnMean(ix));
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
	return xs.map((x, ix) => {
		let sum = 0;
		let n = 0;
		for (let iy = 0; iy < field.rows; iy++) {
			const value = field.values[iy * field.cols + ix];
			if (Number.isFinite(value)) {
				sum += value;
				n++;
			}
		}
		return { x, survival: n ? sum / n : NaN };
	});
}

/** The default per-cell run size, as a RunSize the batch spreads onto each request. */
export const LANDSCAPE_RUN: RunSize = {
	seeds: LANDSCAPE_DEFAULTS.seeds,
	episodes: LANDSCAPE_DEFAULTS.episodes,
	bouts: LANDSCAPE_DEFAULTS.bouts
};
