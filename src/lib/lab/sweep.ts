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
import type { EvalRequest, Evaluation, RunSize } from './evaluator';
import { contrast, type Contrast } from './stats';
import type { EffectRow } from './evidence';

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

/** The effects as the compact EffectRow the graph and the notebook share — one converter, so the
 *  Sweep's summary and the Report's Q2 can't shape the evidence differently. */
export function toEffectRows(effects: FactorEffect[]): EffectRow[] {
	return effects.map((e) => ({
		label: e.label,
		delta: e.effect.delta,
		lo: e.effect.ci.lo,
		hi: e.effect.ci.hi
	}));
}

/* ================================ the pin-or-sweep knob model =================================
 *
 * Since the redesign, every knob has ONE home: the design panel, where it is either PINNED (it
 * holds that value in every cell) or SWEPT (it becomes a factor). Booleans are three-state
 * off·on·sweep; graded knobs are multi-select level chips — one chip pins, two or more sweep.
 * The model COMPILES to the Factor machinery above (`sweptFactors`) and to a pinned base config
 * (`pinBase`), so the proven factorial/effects code runs unchanged underneath.
 */

export type KnobState = 'off' | 'on' | 'sweep';

/** The panel's section a knob renders under. */
export type KnobGroupKey = 'senses' | 'body' | 'predator' | 'shoal';

/** One boolean knob: a sense, an instinct, or a predator rule. */
export interface BoolKnob {
	key: string;
	label: string;
	/** The one-line explainer under the name in the panel. */
	detail: string;
	group: KnobGroupKey;
	/** The panel's starting position — the generic ocean's own value, or 'sweep' for the defaults
	 *  the instrument opens with (direction/distance/persistence: the questions worth asking first). */
	defaultState: KnobState;
	/** Own-speed only: needs the 9-input brain, so the panel disables it and offers the switch. */
	needsNineInputs?: boolean;
	apply: (cfg: WorldConfig, on: boolean) => WorldConfig;
}

/** One graded knob: a numeric level picked from chips. */
export interface GradedKnob {
	key: string;
	label: string;
	/** The chip values offered — real, measured engine values, not round numbers. */
	values: number[];
	/** One chip = pinned at that value; two or more = swept as a factor. */
	defaultSelected: number[];
	format: (value: number) => string;
	apply: (cfg: WorldConfig, value: number) => WorldConfig;
}

const senseKnob = (
	key: 'dir' | 'dist' | 'closing' | 'walls' | 'speed',
	label: string,
	detail: string,
	defaultState: KnobState,
	needsNineInputs?: boolean
): BoolKnob => ({
	key,
	label,
	detail,
	group: 'senses',
	defaultState,
	needsNineInputs,
	apply: (cfg, on) => ({ ...cfg, senses: { ...cfg.senses, [key]: on } })
});

/**
 * Every boolean knob the sweep offers, in panel order. Default pins mirror the generic ocean
 * (walls/closing/darting on; stamina/committed/confusion off), so a fresh panel describes the
 * world as it IS; the three default sweeps are the platform's first questions (direction,
 * distance, hunger escalation).
 */
export const BOOL_KNOBS: BoolKnob[] = [
	senseKnob('dir', 'Direction', 'which way the shark is', 'sweep'),
	senseKnob('dist', 'Distance', 'how far it is', 'sweep'),
	senseKnob('walls', 'Walls', 'nearness of the glass', 'on'),
	senseKnob('closing', 'Closing speed', 'is it gaining', 'on'),
	senseKnob('speed', 'Own speed', 'the fish’s own pace — needs the 9-input brain', 'off', true),
	{
		key: 'stamina',
		label: 'Stamina',
		detail: 'sprinting drains a tank; empty = half speed',
		group: 'body',
		defaultState: 'off',
		apply: (cfg, on) => ({ ...cfg, stamina: on })
	},
	{
		key: 'wallInstinct',
		label: 'Wall avoidance',
		detail: 'the built-in instinct to shy off the glass',
		group: 'body',
		defaultState: 'on',
		apply: (cfg, on) => ({ ...cfg, wallInstinct: on })
	},
	{
		key: 'persistence',
		label: 'Hunger escalation',
		detail: 'faster + wider jaw while starving',
		group: 'predator',
		defaultState: 'sweep',
		apply: (cfg, on) => ({ ...cfg, persistence: on })
	},
	{
		key: 'lunge',
		label: 'Darting',
		detail: 'the cruise → aim → lunge strike',
		group: 'predator',
		defaultState: 'on',
		apply: (cfg, on) => ({ ...cfg, lunge: on })
	},
	{
		key: 'lungeCommit',
		label: 'Committed lunge',
		detail: 'the strike locks at launch; a dodge beats it',
		group: 'predator',
		defaultState: 'off',
		apply: (cfg, on) => ({ ...cfg, lungeCommit: on })
	},
	{
		key: 'confusion',
		label: 'Confusion effect',
		detail: 'a crowded fish is hard to catch',
		group: 'shoal',
		defaultState: 'off',
		apply: (cfg, on) => ({ ...cfg, confusion: on })
	}
];

/**
 * Every graded knob, in panel order. Values are the ENGINE's honest numbers (mutation lives in
 * 0..0.2 with 0.06 the reference — not a 0..1 slider), and prey is a PERCENT of the subject's base
 * count, so the same design scales with the world it runs on.
 */
export const GRADED_KNOBS: GradedKnob[] = [
	{
		key: 'predSpeed',
		label: 'Predator speed ×',
		values: [0.6, 0.7, 0.8, 0.9, 1.0, 1.1],
		defaultSelected: [0.6, 0.8, 1.0],
		format: (v) => `${v.toFixed(1)}×`,
		apply: (cfg, v) => ({ ...cfg, predSpeed: v })
	},
	{
		key: 'preyPct',
		label: 'Prey population % of base',
		values: [50, 75, 100, 150],
		defaultSelected: [50, 100],
		format: (v) => `${v}%`,
		apply: (cfg, v) => ({ ...cfg, prey: Math.max(2, Math.round((cfg.prey * v) / 100)) })
	},
	{
		key: 'vision',
		label: 'Vision px',
		values: [120, 160, 200, 240],
		defaultSelected: [200],
		format: (v) => String(v),
		apply: (cfg, v) => ({ ...cfg, vision: v })
	},
	{
		key: 'maxSpeed',
		label: 'Top speed px/s',
		values: [132, 154, 176, 198],
		defaultSelected: [176],
		format: (v) => String(v),
		apply: (cfg, v) => ({ ...cfg, maxSpeed: v })
	},
	{
		key: 'agility',
		label: 'Agility ×',
		values: [0.8, 1.0, 1.2],
		defaultSelected: [1.0],
		format: (v) => `${v.toFixed(1)}×`,
		apply: (cfg, v) => ({ ...cfg, agility: v })
	},
	{
		key: 'mutation',
		label: 'Mutation rate',
		values: [0.03, 0.06, 0.12],
		defaultSelected: [0.06],
		format: (v) => v.toFixed(2),
		apply: (cfg, v) => ({ ...cfg, mutation: v })
	}
];

/** The panel's resolved choices — what the store holds, what the plan is built from. */
export interface KnobChoices {
	/** knob key → its three-state position. */
	bools: Record<string, KnobState>;
	/** knob key → the selected chip values (1 = pinned, ≥2 = swept). */
	graded: Record<string, number[]>;
}

/** The panel's starting choices, straight from the catalog's defaults. */
export function defaultChoices(): KnobChoices {
	return {
		bools: Object.fromEntries(BOOL_KNOBS.map((k) => [k.key, k.defaultState])),
		graded: Object.fromEntries(GRADED_KNOBS.map((k) => [k.key, [...k.defaultSelected]]))
	};
}

/**
 * Pin every unswept knob onto the base — the world every cell starts from. Pinned booleans apply
 * their off/on; a single-chip graded knob applies its one value; swept knobs are left for the
 * factorial. Order (bools, then graded) matters only to preyPct, which scales the PINNED base.
 */
export function pinBase(base: WorldConfig, choices: KnobChoices): WorldConfig {
	let cfg = base;
	for (const knob of BOOL_KNOBS) {
		const state = choices.bools[knob.key];
		if (state === 'off' || state === 'on') cfg = knob.apply(cfg, state === 'on');
	}
	for (const knob of GRADED_KNOBS) {
		const selected = choices.graded[knob.key] ?? [];
		if (selected.length === 1) cfg = knob.apply(cfg, selected[0]);
	}
	return cfg;
}

/**
 * Compile the SWEPT knobs into the factorial's Factor shape — the proven expandSweep/planSweep/
 * sweepEffects machinery runs the redesign unchanged. Graded levels sort ascending, so a main
 * effect always reads bottom-level → top-level.
 */
export function sweptFactors(choices: KnobChoices): Factor[] {
	const factors: Factor[] = [];
	for (const knob of BOOL_KNOBS) {
		if (choices.bools[knob.key] !== 'sweep') continue;
		factors.push({
			key: knob.key,
			label: knob.label,
			levels: [
				{ label: 'off', apply: (cfg) => knob.apply(cfg, false) },
				{ label: 'on', apply: (cfg) => knob.apply(cfg, true) }
			]
		});
	}
	for (const knob of GRADED_KNOBS) {
		const selected = choices.graded[knob.key] ?? [];
		if (selected.length < 2) continue;
		factors.push({
			key: knob.key,
			label: knob.label,
			levels: [...selected]
				.sort((a, b) => a - b)
				.map((v) => ({ label: knob.format(v), apply: (cfg: WorldConfig) => knob.apply(cfg, v) }))
		});
	}
	return factors;
}

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
	{ maxCells, rng }: { maxCells: number; rng: () => number }
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
export function sweepJobs(cells: SweepCell[], size: RunSize): EvalRequest[] {
	return cells.map((cell) => ({ cfg: cell.cfg, ...size }));
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
