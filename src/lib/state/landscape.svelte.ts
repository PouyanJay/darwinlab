/**
 * The Atlas store — two axes in, a survival landscape out.
 *
 * Since the landscape-panel redesign it owns the whole DESIGN: which two parameters the plane
 * varies and the (per-axis, remembered) range of each, the grid resolution from a fixed menu, the
 * two-state pinned background every cell shares, and the budget — seeds per cell and training
 * length. Running compiles pins onto the subject, writes the axes over it cell by cell, and turns
 * the grid into one batch through the shared `research` lifecycle; nothing here re-implements the
 * measurement or the batch.
 *
 * The map keeps its OWN pan/zoom camera (`Viewport`) inside LandscapeMap — never shared with the
 * lineage tree. "Watch this world" is the one place Research reaches back into Studio: it drops the
 * drilled cell's config onto the bench as a fresh world and switches the lab to Studio, so a point
 * on the map becomes a world you can actually watch evolve.
 */

import { SvelteMap } from 'svelte/reactivity';
import {
	CANDIDATE_AXES,
	planLandscape,
	landscapeJobs,
	landscapeField,
	steepestFalloff,
	rowCliffs,
	rowSection,
	pinnedBase,
	spanAxis,
	valueAt,
	LANDSCAPE_DEFAULTS,
	type LandscapeAxis,
	type LandscapeCell,
	type LandscapeField,
	type LandscapePlan,
	type Falloff
} from '../lab/landscape';
import { BOOL_KNOBS } from '../lab/sweep';
import { research } from './research.svelte';
import { bench } from './bench.svelte';
import { app } from './app.svelte';
import { loadSimRate } from './sweep.svelte';
import type { JobExecutor } from '../lab/runner';

/** The two parameters the plane opens on — the predator-speed cliff against evolutionary drift. */
const DEFAULT_X = 'predSpeed';
const DEFAULT_Y = 'mutation';

/** A neighbour step where survival falls this much is "the edge" — the drill's plain-words line. */
export const EDGE_DROP_SECONDS = 0.8;

/** What the last run measured with — the honesty tiles print this, frozen, not the live panel. */
export interface LandscapeReceipt {
	seeds: number;
	episodes: number;
	wallSeconds: number;
}

class LandscapeStore {
	readonly axes: LandscapeAxis[] = CANDIDATE_AXES;

	#xKey = $state<string>(DEFAULT_X);
	#yKey = $state<string>(DEFAULT_Y);
	// Edited ranges, remembered PER AXIS — swap axes and back, and your range is still yours.
	#spans = new SvelteMap<string, { from: number; to: number }>();
	#resolution = $state<number>(LANDSCAPE_DEFAULTS.resolution);
	#seeds = $state<number>(LANDSCAPE_DEFAULTS.seeds);
	#episodes = $state<number>(LANDSCAPE_DEFAULTS.episodes);
	// The two-state pins. A key never touched follows the subject's own truth (knob.read on read).
	#pins = new SvelteMap<string, boolean>();

	// The run's outputs, replaced wholesale — never mutated in place (the field is a flat array the
	// map reads every repaint). `#plan` is kept so a picked (ix, iy) resolves back to its cell + cfg.
	#plan = $state.raw<LandscapePlan | null>(null);
	#field = $state.raw<LandscapeField | null>(null);
	#selected = $state.raw<LandscapeCell | null>(null);
	#receipt = $state.raw<LandscapeReceipt | null>(null);

	// Falls back to the first axis on an unknown key — deliberately defensive. The picker only ever
	// passes a real `axis.key`, so this is unreachable today; it keeps a future renamed key from
	// throwing rather than silently mislabelling, and the picker's own `selected` state stays honest.
	#axis(key: string): LandscapeAxis {
		return this.axes.find((axis) => axis.key === key) ?? this.axes[0];
	}

	/** An axis narrowed to its remembered range — what the plan and the panel's inputs both read. */
	#spanned(key: string): LandscapeAxis {
		const axis = this.#axis(key);
		const span = this.#spans.get(key);
		return span ? spanAxis(axis, span.from, span.to) : axis;
	}

	get axisX(): LandscapeAxis {
		return this.#spanned(this.#xKey);
	}

	get axisY(): LandscapeAxis {
		return this.#spanned(this.#yKey);
	}

	/** Choose the X axis; if it collides with Y, the two swap rather than plotting a knob against itself. */
	setX(key: string): void {
		if (key === this.#yKey) this.#yKey = this.#xKey;
		this.#xKey = key;
	}

	setY(key: string): void {
		if (key === this.#xKey) this.#xKey = this.#yKey;
		this.#yKey = key;
	}

	/** Edit one axis's range. The lab's spanAxis owns the clamp/order/degenerate rules; what is
	 *  REMEMBERED is the normalised range, so the inputs re-display what a run would actually use. */
	setSpan(key: string, from: number, to: number): void {
		const spanned = spanAxis(this.#axis(key), from, to);
		this.#spans.set(key, { from: spanned.min, to: spanned.max });
	}

	get resolution(): number {
		return this.#resolution;
	}

	/** Pick a resolution from the fixed menu — an off-menu value snaps to the nearest option. */
	setResolution(value: number): void {
		this.#resolution = [...LANDSCAPE_DEFAULTS.resolutions].reduce((best, option) =>
			Math.abs(option - value) < Math.abs(best - value) ? option : best
		);
	}

	get seeds(): number {
		return this.#seeds;
	}

	setSeeds(value: number): void {
		this.#seeds = this.#clampInt(value, LANDSCAPE_DEFAULTS.minSeeds, LANDSCAPE_DEFAULTS.maxSeeds);
	}

	get episodes(): number {
		return this.#episodes;
	}

	setEpisodes(value: number): void {
		this.#episodes = this.#clampInt(
			value,
			LANDSCAPE_DEFAULTS.minEpisodes,
			LANDSCAPE_DEFAULTS.maxEpisodes
		);
	}

	#clampInt(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, Math.round(value) || min));
	}

	/** One pin's position — an untouched key reads the subject's own truth, so a fresh panel
	 *  describes the world as it IS (the Sweep panel's principle). */
	pin(key: string): boolean {
		const touched = this.#pins.get(key);
		if (touched !== undefined) return touched;
		const knob = BOOL_KNOBS.find((k) => k.key === key);
		return knob ? knob.read(app.base) : false;
	}

	setPin(key: string, on: boolean): void {
		this.#pins.set(key, on);
	}

	/** Forget every explicit pin — back to describing the subject as it is. The testkit's walk-back
	 *  (the singleton-spec precedent sweep.resetCalibration set); no panel control needs it yet. */
	clearPins(): void {
		this.#pins.clear();
	}

	/** Every pin the run would compile, explicit AND inherited — what `run` hands to pinnedBase. */
	get pins(): Record<string, boolean> {
		return Object.fromEntries(BOOL_KNOBS.map((knob) => [knob.key, this.pin(knob.key)]));
	}

	/** How many cells the current resolution will measure — shown before a run. */
	get plannedCells(): number {
		return this.#resolution * this.#resolution;
	}

	/** Estimated wall-clock seconds, priced by the same calibrated sim rate as the Sweep's. */
	get estimatedSeconds(): number {
		const simSeconds =
			this.plannedCells * this.#seeds * (this.#episodes + LANDSCAPE_DEFAULTS.bouts) * 10;
		return simSeconds / loadSimRate();
	}

	get running(): boolean {
		return research.running;
	}

	get progress(): number {
		return research.progress;
	}

	get field(): LandscapeField | null {
		return this.#field;
	}

	/** The last run's budget + wall clock, frozen — what the honesty tiles print. */
	get receipt(): LandscapeReceipt | null {
		return this.#receipt;
	}

	/** The steepest fall-off along X in the current field — the cliff headline, or null if none. */
	get falloff(): Falloff | null {
		return this.#field ? steepestFalloff(this.#field) : null;
	}

	/** Each row's own steepest fall-off — the gold dashes the map traces (null rows stay untraced). */
	get cliffRows(): (Falloff | null)[] {
		return this.#field ? rowCliffs(this.#field) : [];
	}

	/** The bottom and top rows as curves — the cross-section card's two lines, with their Y values. */
	get sections(): { y: number; points: { x: number; survival: number }[] }[] {
		const field = this.#field;
		if (!field || field.rows < 2) return [];
		return [0, field.rows - 1].map((iy) => ({
			y: field.axisY.min + ((field.axisY.max - field.axisY.min) * iy) / (field.rows - 1),
			points: rowSection(field, iy)
		}));
	}

	/** The cell the user has drilled into, or null. */
	get selected(): LandscapeCell | null {
		return this.#selected;
	}

	/** Mean survival at the drilled cell (NaN if none / unmeasured) — the number the drill card shows. */
	get selectedValue(): number {
		if (!this.#field || !this.#selected) return NaN;
		return valueAt(this.#field, this.#selected.ix, this.#selected.iy);
	}

	/** Survival change one grid step away from the drilled cell, or null at the map's edge — the
	 *  drill's neighbour readout, the map's geometry made local. */
	neighborDelta(dx: number, dy: number): number | null {
		if (!this.#field || !this.#selected) return null;
		const ix = this.#selected.ix + dx;
		const iy = this.#selected.iy + dy;
		if (ix < 0 || iy < 0 || ix >= this.#field.cols || iy >= this.#field.rows) return null;
		const here = this.selectedValue;
		const there = valueAt(this.#field, ix, iy);
		if (!Number.isFinite(here) || !Number.isFinite(there)) return null;
		return there - here;
	}

	/** Drill into a grid coordinate — opens the cell's world for a closer look. */
	select(ix: number, iy: number): void {
		if (!this.#plan) return;
		this.#selected = this.#plan.cells.find((cell) => cell.ix === ix && cell.iy === iy) ?? null;
	}

	clearSelection(): void {
		this.#selected = null;
	}

	/**
	 * Run the landscape: compile the pins onto the subject, plan the grid over the spanned axes,
	 * measure every cell through the batch runner, and keep the field — unless a newer run
	 * superseded this one, in which case `research.run` returns null and this publishes nothing.
	 * Clears any prior drill-in, since the old cell is not in the new grid.
	 */
	async run(executor?: JobExecutor): Promise<void> {
		const base = pinnedBase(app.subjectBase('Atlas'), this.pins);
		const plan = planLandscape(base, this.axisX, this.axisY, this.#resolution);
		const jobs = landscapeJobs(plan.cells, {
			seeds: this.#seeds,
			episodes: this.#episodes,
			bouts: LANDSCAPE_DEFAULTS.bouts
		});

		const started = performance.now();
		const results = await research.run(jobs, executor);
		if (!results) return;

		this.#plan = plan;
		this.#field = landscapeField(plan, results);
		this.#selected = null;
		this.#receipt = {
			seeds: this.#seeds,
			episodes: this.#episodes,
			wallSeconds: (performance.now() - started) / 1000
		};
	}

	cancel(): void {
		research.cancel();
	}

	/**
	 * Watch a point on the map evolve: drop its config onto the bench as a fresh, named world and
	 * switch to Studio. The name encodes where on the plane it came from — read from the FIELD's
	 * frozen axes, so a panel edit after the run cannot mislabel the world it hands over.
	 */
	watch(cell: LandscapeCell): void {
		const axisX = this.#field?.axisX ?? this.axisX;
		const axisY = this.#field?.axisY ?? this.axisY;
		const name = `${axisX.label} ${axisX.format(cell.x)} · ${axisY.label} ${axisY.format(cell.y)}`;
		bench.addWorld({ ...cell.cfg, name });
		app.setMode('studio');
	}
}

export const landscape = new LandscapeStore();
