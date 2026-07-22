/**
 * The Sweep store — the state behind the first Research instrument.
 *
 * It owns which factors are in the sweep and how many seeds each cell runs; turns that into a batch
 * of evaluations through the shared `research` lifecycle store; and, once the results are in, derives
 * the per-cell survival grid the heatmap paints and the per-factor main effects the chart reports.
 *
 * Nothing here re-implements the measurement or the batch lifecycle — it composes `sweep.ts` (the
 * pure factorial) with the `research` store (the run) and `stats` (the effect sizes, via sweep.ts).
 */

import {
	CANDIDATE_FACTORS,
	planSweep,
	sweepJobs,
	sweepEffects,
	SWEEP_DEFAULTS,
	type Factor,
	type SweepCell,
	type FactorEffect
} from '../lab/sweep';
import { research } from './research.svelte';
import { app } from './app.svelte';
import { bench } from './bench.svelte';
import { seededRng } from '../engine';
import { SvelteSet } from 'svelte/reactivity';
import type { JobExecutor } from '../lab/runner';
import type { Evaluation } from '../lab/evaluator';

/** A drilled cell of the run grid — its condition column and seed row. */
export interface SweepSelection {
	condition: number;
	seed: number;
}

/** The factors the sweep starts with selected — a real but bounded grid (2×2×2×3 = 24 cells). */
const DEFAULT_SELECTED = ['dir', 'dist', 'walls', 'predSpeed'];

/** Seeds a cell may run, so the store clamps its own invariant rather than trusting a caller. */
const SEED_RANGE = { min: 2, max: 12 };

class SweepStore {
	// A SvelteSet is reactive on mutation, so `.add`/`.delete` in toggle wake the readers directly.
	#selected = new SvelteSet<string>(DEFAULT_SELECTED);
	#seeds = $state<number>(SWEEP_DEFAULTS.seeds);

	// The run's outputs, replaced wholesale — never mutated in place (they are large and unreactive
	// per cell). `cells` and `results` stay index-aligned: results[i] is the result for cells[i].
	#cells = $state.raw<SweepCell[]>([]);
	#results = $state.raw<(Evaluation | null)[] | null>(null);
	#total = $state(0);
	#sampled = $state(false);

	// The factors the current results were computed for, captured at run time so a toggle after a run
	// does not re-pool the old results against a factor set they were never measured on.
	#lastFactors: Factor[] = [];

	// The drilled cell of the run grid, or null. Store-owned (like the Atlas's `selected`) so a new run
	// clears it AS PART of the run — its indices belonged to the old grid.
	#drilled = $state.raw<SweepSelection | null>(null);

	/** Every factor the sweep could include, in offered order. */
	get factors(): Factor[] {
		return CANDIDATE_FACTORS;
	}

	isSelected(key: string): boolean {
		return this.#selected.has(key);
	}

	toggle(key: string): void {
		if (this.#selected.has(key)) this.#selected.delete(key);
		else this.#selected.add(key);
	}

	get seeds(): number {
		return this.#seeds;
	}

	/** Set the seed count, clamped to a sane range — the store owns this invariant, not the control. */
	setSeeds(value: number): void {
		const clamped = Math.round(value) || SEED_RANGE.min;
		this.#seeds = Math.max(SEED_RANGE.min, Math.min(SEED_RANGE.max, clamped));
	}

	#selectedFactors(): Factor[] {
		return CANDIDATE_FACTORS.filter((factor) => this.#selected.has(factor.key));
	}

	/** The full factorial size of the current selection — what "N conditions" means before the cap. */
	get plannedCells(): number {
		return this.#selectedFactors().reduce((count, factor) => count * factor.levels.length, 1);
	}

	/** True when the current selection would overflow the cap and be sampled. */
	get willSample(): boolean {
		return this.plannedCells > SWEEP_DEFAULTS.maxCells;
	}

	get running(): boolean {
		return research.running;
	}

	get progress(): number {
		return research.progress;
	}

	get cells(): SweepCell[] {
		return this.#cells;
	}

	get results(): (Evaluation | null)[] | null {
		return this.#results;
	}

	/** The full factorial size the last run was drawn from (may exceed the cells actually measured). */
	get total(): number {
		return this.#total;
	}

	/** True when the last run measured a sampled subset rather than every cell. */
	get sampled(): boolean {
		return this.#sampled;
	}

	/** The drilled cell of the run grid, or null — the one the RunCellCard opens below the grid. */
	get selected(): SweepSelection | null {
		return this.#drilled;
	}

	/** Drill into a cell — open its condition's world below the grid. */
	select(condition: number, seed: number): void {
		this.#drilled = { condition, seed };
	}

	clearSelection(): void {
		this.#drilled = null;
	}

	/** The per-factor main effects of the last run — empty until there is a result. */
	get effects(): FactorEffect[] {
		if (!this.#results) return [];
		return sweepEffects(this.#lastFactors, this.#cells, this.#results);
	}

	/**
	 * Run the sweep: plan it, run every cell through the batch runner, and keep the results — unless a
	 * newer run superseded this one, in which case `research.run` returns null and this publishes
	 * nothing. `executor` overrides the pool for tests, exactly as it does on the ledger and Atlas.
	 */
	async run(executor?: JobExecutor): Promise<void> {
		const factors = this.#selectedFactors();
		if (factors.length === 0) return;

		const base = app.subjectBase('Sweep');
		const plan = planSweep(base, factors, { maxCells: SWEEP_DEFAULTS.maxCells, rng: seededRng(1) });
		const jobs = sweepJobs(plan.cells, {
			seeds: this.#seeds,
			episodes: SWEEP_DEFAULTS.episodes,
			bouts: SWEEP_DEFAULTS.bouts
		});

		const results = await research.run(jobs, executor);
		if (!results) return;

		this.#lastFactors = factors;
		this.#cells = plan.cells;
		this.#total = plan.total;
		this.#sampled = plan.sampled;
		this.#results = results;
		this.#drilled = null; // a fresh grid — the old drilled cell is gone
	}

	cancel(): void {
		research.cancel();
	}

	/**
	 * Watch a drilled condition evolve in Studio — the Sweep→Studio round-trip, the same shape as the
	 * Atlas's `watch`: drop the condition's config onto the bench as a fresh, named world and switch
	 * modes, so a cell in the run grid becomes a world you can actually watch. The name encodes the
	 * factor levels that define the condition, so the new node says which cell it came from.
	 */
	watch(cell: SweepCell): void {
		const name =
			Object.entries(cell.levels)
				.map(([key, level]) => {
					const factor = CANDIDATE_FACTORS.find((f) => f.key === key)?.label ?? key;
					return `${factor} ${level}`;
				})
				.join(' · ') || 'Sweep world';
		bench.addWorld({ ...cell.cfg, name });
		app.setMode('studio');
	}
}

export const sweep = new SweepStore();
