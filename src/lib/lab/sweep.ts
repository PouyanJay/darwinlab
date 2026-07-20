/**
 * The Sweep — the factorial the ablation matrix always wanted to be.
 *
 * A FACTOR is one knob with a few LEVELS (a sense off vs on; three predator speeds). Choose some
 * factors and the sweep is their full cross-product: every combination, each run across N seeds. The
 * conclusion is the MAIN EFFECT of each factor — how much moving it from its bottom level to its top
 * level changes survival, marginalised over every other factor, with a bootstrap interval. A bar that
 * clears zero is a factor that matters; one that straddles zero is a knob that does nothing here.
 *
 * Pure: factors are config PATCHES, so this knows nothing about the engine beyond WorldConfig, and
 * the whole module is node-testable without a worker.
 */

import type { WorldConfig } from '../engine';
import type { EvalRequest, Evaluation } from './evaluator';
import { contrast, type Contrast } from './stats';

/** Sensible defaults for a sweep — smaller than a single Evaluate, because there are many cells. */
export const SWEEP_DEFAULTS = { seeds: 6, episodes: 20, bouts: 4, maxCells: 32 } as const;

/** One setting of a factor, expressed as a patch onto a base config. */
export interface FactorLevel {
	label: string;
	apply: (cfg: WorldConfig) => WorldConfig;
}

/** One knob the sweep can vary, and the levels it takes. */
export interface Factor {
	key: string;
	label: string;
	levels: FactorLevel[];
}

/** One combination of levels — a single environment the sweep measures. */
export interface SweepCell {
	index: number;
	/** factor key → the label of the level this cell took, for reading the heatmap and pooling arms. */
	levels: Record<string, string>;
	cfg: WorldConfig;
}

/** A sweep sized to run: the cells to measure, the full factorial size, and whether we sampled it. */
export interface SweepPlan {
	cells: SweepCell[];
	/** The full cross-product size — what we WOULD run without the cap. */
	total: number;
	/** True when the factorial exceeded the cap and we measured a random subset instead. */
	sampled: boolean;
}

/** The conclusion for one factor: moving it bottom → top level is worth this, ± this. */
export interface FactorEffect {
	key: string;
	label: string;
	from: string;
	to: string;
	effect: Contrast;
}

/** A sense channel as a two-level off/on factor. */
export function senseFactor(key: 'dist' | 'dir' | 'closing' | 'walls', label: string): Factor {
	return {
		key,
		label,
		levels: [
			{ label: 'off', apply: (cfg) => ({ ...cfg, senses: { ...cfg.senses, [key]: false } }) },
			{ label: 'on', apply: (cfg) => ({ ...cfg, senses: { ...cfg.senses, [key]: true } }) }
		]
	};
}

/**
 * The factors offered for the predator-prey scenario, most-interesting first. Predator speed is the
 * one that crosses the 0.88 cliff, where the shark starts outrunning every fish; the senses are the
 * observation channels the ablation matrix already varies, generalised here into the same grid.
 */
export const CANDIDATE_FACTORS: Factor[] = [
	senseFactor('dir', 'Direction'),
	senseFactor('dist', 'Distance'),
	senseFactor('walls', 'Walls'),
	senseFactor('closing', 'Closing'),
	{
		key: 'predSpeed',
		label: 'Predator speed',
		levels: [
			{ label: '0.6×', apply: (cfg) => ({ ...cfg, predSpeed: 0.6 }) },
			{ label: '0.8×', apply: (cfg) => ({ ...cfg, predSpeed: 0.8 }) },
			{ label: '1.0×', apply: (cfg) => ({ ...cfg, predSpeed: 1.0 }) }
		]
	},
	{
		key: 'persistence',
		label: 'Persistence',
		levels: [
			{ label: 'off', apply: (cfg) => ({ ...cfg, persistence: false }) },
			{ label: 'on', apply: (cfg) => ({ ...cfg, persistence: true }) }
		]
	},
	{
		key: 'prey',
		label: 'Prey',
		levels: [
			{ label: '12', apply: (cfg) => ({ ...cfg, prey: 12 }) },
			{ label: '20', apply: (cfg) => ({ ...cfg, prey: 20 }) }
		]
	}
];

/** The full cross-product of the factors' levels, each a config built by applying every chosen level. */
export function expandSweep(base: WorldConfig, factors: Factor[]): SweepCell[] {
	let cells: Omit<SweepCell, 'index'>[] = [{ levels: {}, cfg: base }];
	for (const factor of factors) {
		const next: Omit<SweepCell, 'index'>[] = [];
		for (const cell of cells) {
			for (const level of factor.levels) {
				next.push({
					levels: { ...cell.levels, [factor.key]: level.label },
					cfg: level.apply(cell.cfg)
				});
			}
		}
		cells = next;
	}
	return cells.map((cell, index) => ({ ...cell, index }));
}

/**
 * Size the sweep to a cell budget. Under the cap it is the full factorial; over it, a SEEDED random
 * subset — and the plan says so (`sampled`, `total`), because silent truncation reads as "covered
 * everything" when it did not.
 */
export function planSweep(
	base: WorldConfig,
	factors: Factor[],
	maxCells: number,
	rng: () => number
): SweepPlan {
	const all = expandSweep(base, factors);
	if (all.length <= maxCells) return { cells: all, total: all.length, sampled: false };

	// Fisher–Yates over a copy, take the first maxCells — a uniform subset, reproducible from the rng.
	const shuffled = [...all];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	const cells = shuffled.slice(0, maxCells).map((cell, index) => ({ ...cell, index }));
	return { cells, total: all.length, sampled: true };
}

/** One evaluation request per cell — the whole plan becomes one batch. */
export function sweepJobs(
	cells: SweepCell[],
	seeds: number,
	episodes: number,
	bouts: number
): EvalRequest[] {
	return cells.map((cell) => ({ cfg: cell.cfg, seeds, episodes, bouts }));
}

/**
 * The main effect of each factor: pool the per-seed returns of every cell at its TOP level against
 * every cell at its BOTTOM level (marginalising over all other factors) and contrast them. Cells with
 * no result (cancelled/failed) are skipped.
 */
export function sweepEffects(
	factors: Factor[],
	cells: SweepCell[],
	results: (Evaluation | null)[]
): FactorEffect[] {
	return factors.map((factor) => {
		const from = factor.levels[0].label;
		const to = factor.levels[factor.levels.length - 1].label;
		const low: number[] = [];
		const high: number[] = [];

		cells.forEach((cell, i) => {
			const result = results[i];
			if (!result) return;
			if (cell.levels[factor.key] === to) high.push(...result.returns);
			else if (cell.levels[factor.key] === from) low.push(...result.returns);
		});

		return { key: factor.key, label: factor.label, from, to, effect: contrast(high, low) };
	});
}
