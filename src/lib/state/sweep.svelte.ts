/**
 * The Sweep store — the state behind the design panel.
 *
 * It owns the panel's pin-or-sweep choices (every boolean knob's off·on·sweep, every graded knob's
 * selected chips), the run budget (seeds, generations, generation length), and the cap; turns them
 * into a batch of evaluations through the shared `research` lifecycle store; and, once the results
 * are in, derives the per-cell survival grid and the per-factor main effects.
 *
 * Nothing here re-implements the measurement or the batch lifecycle — it composes `sweep.ts` (the
 * knob catalog compiled onto the pure factorial) with the `research` store (the run) and `stats`
 * (the effect sizes, via sweep.ts).
 *
 * HONESTY GUARDS the store owns:
 *  - the estimate is CALIBRATED: the measured sim-rate of the last real run (localStorage) prices
 *    the next one; before any run a conservative fallback is used and the panel says "≈".
 *  - run sizes are tiered: a medium run warns, a large one refuses to start unless the caller
 *    passes the cell count back (`confirmedCells`) — the typed-confirm contract.
 *  - the own-speed sense cannot be swept on an 8-wire brain: the choice is refused at the setter
 *    AND forced off at plan time, so a stale 'sweep' can never produce a two-level factor whose
 *    levels are the same world.
 */

import {
	BOOL_KNOBS,
	GRADED_KNOBS,
	defaultChoices,
	knobLabel,
	hasNineWires,
	pinBase,
	sweptFactors,
	planSweep,
	sweepJobs,
	sweepEffects,
	sweepInteractions,
	SWEEP_DEFAULTS,
	type KnobState,
	type KnobChoices,
	type Factor,
	type SweepCell,
	type SweepPlan,
	type FactorEffect,
	type InteractionEffect
} from '../lab/sweep';
import { research } from './research.svelte';
import { app } from './app.svelte';
import { bench } from './bench.svelte';
import { seededRng, WORLD_LIMITS, clampToRange } from '../engine';
import { browser } from '$app/environment';
import { SvelteMap } from 'svelte/reactivity';
import type { JobExecutor } from '../lab/runner';
import type { Evaluation } from '../lab/evaluator';

/** A drilled cell of the run grid — its condition column and seed row. */
export interface SweepSelection {
	condition: number;
	seed: number;
}

/**
 * The receipt of the last run — its budget and wall clock FROZEN at run time, so the honesty tiles
 * describe the run that happened even after the panel's inputs move on (the same rule as
 * `#lastFactors`: results are never re-described against a design they were not measured on).
 */
export interface SweepRunReceipt {
	seeds: number;
	episodes: number;
	genDuration: number;
	wallSeconds: number;
	/** Whether champion clones were scored beside the population (the "live" toggle). */
	championOn: boolean;
}

/** The store's own clamps — a bad input never reaches a job. */
const SEED_RANGE = { min: 2, max: 12 };
const EPISODE_RANGE = { min: 5, max: 120 };
const CAP_RANGE = { min: 8, max: 256 };

/**
 * Run-size guard tiers, in minutes of ESTIMATED wall clock — the owner's call: a medium run warns,
 * a large one demands the cell count typed back. Exported so the panel and the store cannot
 * disagree about where the tiers sit. Deliberately tunable.
 */
export const GUARD_WARN_MINUTES = 15;
export const GUARD_CONFIRM_MINUTES = 45;

/** Sim-seconds measured per wall-clock second. Fallback before any run has calibrated it. */
const FALLBACK_SIM_RATE = 300;
const SIM_RATE_KEY = 'darwinlab:sweep-sim-rate';

function loadSimRate(): number {
	if (!browser) return FALLBACK_SIM_RATE;
	const raw = Number(localStorage.getItem(SIM_RATE_KEY));
	return Number.isFinite(raw) && raw > 0 ? raw : FALLBACK_SIM_RATE;
}

class SweepStore {
	// The panel's choices. SvelteMaps are reactive on mutation, so a set() wakes the plan readouts.
	#defaults = defaultChoices();
	#bools = new SvelteMap<string, KnobState>(Object.entries(this.#defaults.bools));
	#graded = new SvelteMap<string, number[]>(Object.entries(this.#defaults.graded));

	// The budget. Episodes = generations of training per run; genDuration = sim-seconds each lasts.
	#seeds = $state<number>(SWEEP_DEFAULTS.seeds);
	#episodes = $state<number>(SWEEP_DEFAULTS.episodes);
	#genDuration = $state<number>(WORLD_LIMITS.genDuration.min);

	// The cap: off runs the FULL factorial (the honest default); on samples down to #capN.
	#capOn = $state(false);
	#capN = $state<number>(SWEEP_DEFAULTS.maxCells);

	// The Measurement toggle: score champion clones beside the population, every cell ("live").
	#championOn = $state(false);

	// The calibrated estimate's rate — replaced after every real run (see #recordSimRate).
	#simRate = $state<number>(loadSimRate());
	#calibrated = $state<boolean>(browser ? localStorage.getItem(SIM_RATE_KEY) !== null : false);

	// The run's outputs, replaced wholesale — never mutated in place. `cells` and `results` stay
	// index-aligned: results[i] is the result for cells[i].
	#cells = $state.raw<SweepCell[]>([]);
	#results = $state.raw<(Evaluation | null)[] | null>(null);
	#total = $state(0);
	#sampled = $state(false);

	// The factors the current results were computed for, captured at run time so a panel edit after
	// a run does not re-pool the old results against a design they were never measured on.
	#lastFactors: Factor[] = [];

	// The last run's receipt (budget + wall clock, frozen) — what the honesty tiles print.
	#receipt = $state.raw<SweepRunReceipt | null>(null);

	// The drilled cell of the run grid, or null. Store-owned so a new run clears it AS PART of the
	// run — its indices belonged to the old grid.
	#drilled = $state.raw<SweepSelection | null>(null);

	/* ---------------------------------- the panel's choices ---------------------------------- */

	/** The boolean knob catalog, in panel order. */
	get boolKnobs() {
		return BOOL_KNOBS;
	}

	/** The graded knob catalog, in panel order. */
	get gradedKnobs() {
		return GRADED_KNOBS;
	}

	boolState(key: string): KnobState {
		return this.#bools.get(key) ?? 'off';
	}

	/**
	 * Move a boolean knob between off·on·sweep. The own-speed sense is refused anywhere but 'off'
	 * while the base brain has no 9th wire — the panel offers "switch the subject's brain" instead
	 * of silently changing the control (the owner's call).
	 */
	setBoolState(key: string, state: KnobState): void {
		const knob = BOOL_KNOBS.find((k) => k.key === key);
		if (!knob) return;
		if (knob.needsNineInputs && state !== 'off' && !hasNineWires(app.base)) return;
		this.#bools.set(key, state);
	}

	isLevelSelected(key: string, value: number): boolean {
		return (this.#graded.get(key) ?? []).includes(value);
	}

	/**
	 * Toggle one chip of a graded knob. The LAST chip cannot be deselected — a knob always has a
	 * value (one chip = the pin), so the plan is never built over an undefined level.
	 */
	toggleLevel(key: string, value: number): void {
		const current = this.#graded.get(key) ?? [];
		if (current.includes(value)) {
			if (current.length === 1) return;
			this.#graded.set(
				key,
				current.filter((v) => v !== value)
			);
		} else {
			this.#graded.set(key, [...current, value]);
		}
	}

	/**
	 * The panel's choices resolved for PLANNING: a stale own-speed sweep collapses to 'off' when
	 * the base brain lost its 9th wire, so the factorial can never contain a factor whose two
	 * levels are the same world.
	 */
	#choices(): KnobChoices {
		const bools = Object.fromEntries(this.#bools);
		for (const knob of BOOL_KNOBS) {
			if (knob.needsNineInputs && !hasNineWires(app.base)) bools[knob.key] = 'off';
		}
		return { bools, graded: Object.fromEntries(this.#graded) };
	}

	/* -------------------------------------- the budget --------------------------------------- */

	get seeds(): number {
		return this.#seeds;
	}

	setSeeds(value: number): void {
		if (!Number.isFinite(value)) return;
		this.#seeds = clampToRange(Math.round(value), SEED_RANGE);
	}

	get episodes(): number {
		return this.#episodes;
	}

	setEpisodes(value: number): void {
		if (!Number.isFinite(value)) return;
		this.#episodes = clampToRange(Math.round(value), EPISODE_RANGE);
	}

	get genDuration(): number {
		return this.#genDuration;
	}

	setGenDuration(value: number): void {
		if (!Number.isFinite(value)) return;
		this.#genDuration = clampToRange(Math.round(value), WORLD_LIMITS.genDuration);
	}

	get capOn(): boolean {
		return this.#capOn;
	}

	setCapOn(on: boolean): void {
		this.#capOn = on;
	}

	get capN(): number {
		return this.#capN;
	}

	get championOn(): boolean {
		return this.#championOn;
	}

	setChampionOn(on: boolean): void {
		this.#championOn = on;
	}

	setCapN(value: number): void {
		if (!Number.isFinite(value)) return;
		this.#capN = clampToRange(Math.round(value), CAP_RANGE);
	}

	/* ------------------------------------ the plan readout ------------------------------------ */

	/** The factors the current choices sweep — what the plan line names. */
	get plannedFactors(): Factor[] {
		return sweptFactors(this.#choices());
	}

	/** The full factorial size of the current design. */
	get plannedCells(): number {
		return this.plannedFactors.reduce((count, factor) => count * factor.levels.length, 1);
	}

	/** The cells that will actually run once the cap has its say. */
	get cellsToRun(): number {
		return this.#capOn ? Math.min(this.#capN, this.plannedCells) : this.plannedCells;
	}

	/** True when the cap would sample the factorial rather than run all of it. */
	get willSample(): boolean {
		return this.#capOn && this.plannedCells > this.#capN;
	}

	/** ONE sim-seconds formula for the estimate AND the calibration — champion doubles the bouts,
	 *  and pricing a finished run with fewer seconds than it spent would silently skew every
	 *  estimate after it (the drift the calibration exists to prevent). */
	#simSecondsFor(cells: number, championOn: boolean): number {
		const bouts = SWEEP_DEFAULTS.bouts * (championOn ? 2 : 1);
		return cells * this.#seeds * (this.#episodes + bouts) * this.#genDuration;
	}

	/** Total sim-seconds the design asks for — the estimate must price what the toggle costs. */
	get plannedSimSeconds(): number {
		return this.#simSecondsFor(this.cellsToRun, this.#championOn);
	}

	/** Estimated wall-clock seconds, priced by the calibrated (or fallback) sim-rate. */
	get estimatedSeconds(): number {
		return this.plannedSimSeconds / this.#simRate;
	}

	/** True once a real run has calibrated the estimate — before that the panel hedges with "≈". */
	get estimateCalibrated(): boolean {
		return this.#calibrated;
	}

	/** Forget the calibrated rate and fall back to the conservative default — the door a
	 *  recalibration control (and the test kit) uses. */
	resetCalibration(): void {
		this.#simRate = FALLBACK_SIM_RATE;
		this.#calibrated = false;
		if (browser) localStorage.removeItem(SIM_RATE_KEY);
	}

	/** The run-size tier: none, warn (medium), or confirm (large — run() demands the cell count). */
	get guard(): 'none' | 'warn' | 'confirm' {
		const minutes = this.estimatedSeconds / 60;
		if (minutes >= GUARD_CONFIRM_MINUTES) return 'confirm';
		if (minutes >= GUARD_WARN_MINUTES) return 'warn';
		return 'none';
	}

	/* ------------------------------------- run lifecycle -------------------------------------- */

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

	/** The full factorial size the last run was drawn from (may exceed the cells measured). */
	get total(): number {
		return this.#total;
	}

	/** True when the last run measured a sampled subset rather than every cell. */
	get sampled(): boolean {
		return this.#sampled;
	}

	/** The last run's frozen budget + wall clock, or null before any run. */
	get receipt(): SweepRunReceipt | null {
		return this.#receipt;
	}

	get selected(): SweepSelection | null {
		return this.#drilled;
	}

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

	/** Every factor pair's interaction from the last run — empty until there are two factors. */
	get interactions(): InteractionEffect[] {
		if (!this.#results) return [];
		return sweepInteractions(this.#lastFactors, this.#cells, this.#results);
	}

	/** The factors the last run measured — what the convergence card picks its arms from. */
	get lastFactors(): Factor[] {
		return this.#lastFactors;
	}

	/** Price a finished run and remember it — the next estimate is bought with this one's receipt. */
	#recordSimRate(simSeconds: number, wallSeconds: number): void {
		if (wallSeconds < 1) return; // a test executor settling in microseconds is not a price
		this.#simRate = simSeconds / wallSeconds;
		this.#calibrated = true;
		if (browser) localStorage.setItem(SIM_RATE_KEY, String(this.#simRate));
	}

	/**
	 * Run the design. A zero-factor design is legal — one cell, the pinned world, measured. A
	 * 'confirm'-tier run REFUSES to start unless the caller passes the exact cell count back
	 * (`confirmedCells`) — the typed-confirm contract the panel implements.
	 */
	async run(executor?: JobExecutor, opts: { confirmedCells?: number } = {}): Promise<void> {
		if (this.guard === 'confirm' && opts.confirmedCells !== this.cellsToRun) return;

		const choices = this.#choices();
		const base = pinBase({ ...app.subjectBase('Sweep'), genDuration: this.#genDuration }, choices);
		const factors = sweptFactors(choices);
		const plan = planSweep(base, factors, {
			maxCells: this.#capOn ? this.#capN : Number.POSITIVE_INFINITY,
			rng: seededRng(1)
		});
		// FROZEN at launch: a toggle flipped mid-run must not relabel the receipt or the calibration
		// of the run that was actually submitted.
		const championOn = this.#championOn;
		const jobs = sweepJobs(
			plan.cells,
			{ seeds: this.#seeds, episodes: this.#episodes, bouts: SWEEP_DEFAULTS.bouts },
			{ champion: championOn }
		);

		const started = performance.now();
		const results = await research.run(jobs, executor);
		if (!results) return;
		this.#commitRun(plan, factors, results, (performance.now() - started) / 1000, championOn);
	}

	/** Publish a finished run in one move: price it, freeze its receipt, land its outputs. */
	#commitRun(
		plan: SweepPlan,
		factors: Factor[],
		results: (Evaluation | null)[],
		wallSeconds: number,
		championOn: boolean
	): void {
		this.#recordSimRate(this.#simSecondsFor(plan.cells.length, championOn), wallSeconds);
		this.#receipt = {
			seeds: this.#seeds,
			episodes: this.#episodes,
			genDuration: this.#genDuration,
			wallSeconds,
			championOn
		};
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
	 * Watch a drilled condition evolve in Studio — the Sweep→Studio round-trip. The name encodes
	 * the factor levels that define the condition, looked up in the knob catalogs so it says
	 * "Direction on", never "dir on".
	 */
	watch(cell: SweepCell): void {
		const name =
			Object.entries(cell.levels)
				.map(([key, level]) => `${knobLabel(key)} ${level}`)
				.join(' · ') || 'Sweep world';
		bench.addWorld({ ...cell.cfg, name });
		app.setMode('studio');
	}
}

export const sweep = new SweepStore();
