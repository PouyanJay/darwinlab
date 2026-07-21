/**
 * The Atlas store — two axes in, a survival landscape out.
 *
 * It owns which two parameters the plane varies, the grid resolution and seeds each cell runs, and —
 * once a run is in — the measured field, the steepest fall-off it found, and which cell the user has
 * drilled into. Running turns the grid into one batch through the shared `research` lifecycle;
 * nothing here re-implements the measurement or the batch.
 *
 * It carries its OWN pan/zoom camera (`view`): the Atlas map is pannable exactly like the lineage
 * tree, but the two must never share a camera, so each holds a separate `Viewport`.
 *
 * "Watch this world" is the one place Research reaches back into Studio: it drops the drilled cell's
 * config onto the bench as a fresh world and switches the lab to Studio, so a point on the map
 * becomes a world you can actually watch evolve.
 */

import {
	CANDIDATE_AXES,
	planLandscape,
	landscapeJobs,
	landscapeField,
	steepestFalloff,
	valueAt,
	LANDSCAPE_DEFAULTS,
	type LandscapeAxis,
	type LandscapeCell,
	type LandscapeField,
	type LandscapePlan,
	type Falloff
} from '../lab/landscape';
import { research } from './research.svelte';
import { bench } from './bench.svelte';
import { app } from './app.svelte';
import { Viewport } from './viewport.svelte';
import type { JobExecutor } from '../lab/runner';

/** The two parameters the plane opens on — the predator-speed cliff against evolutionary drift. */
const DEFAULT_X = 'predSpeed';
const DEFAULT_Y = 'mutation';

class LandscapeStore {
	readonly axes: LandscapeAxis[] = CANDIDATE_AXES;

	/** The Atlas's own camera — wider zoom range than the tree, to drill into a cliff. */
	readonly view = new Viewport({ minScale: 0.4, maxScale: 4 });

	#xKey = $state<string>(DEFAULT_X);
	#yKey = $state<string>(DEFAULT_Y);
	#resolution = $state<number>(LANDSCAPE_DEFAULTS.resolution);
	#seeds = $state<number>(LANDSCAPE_DEFAULTS.seeds);

	// The run's outputs, replaced wholesale — never mutated in place (the field is a flat array the
	// map reads every repaint). `#plan` is kept so a picked (ix, iy) resolves back to its cell + cfg.
	#plan = $state.raw<LandscapePlan | null>(null);
	#field = $state.raw<LandscapeField | null>(null);
	#selected = $state.raw<LandscapeCell | null>(null);

	// Falls back to the first axis on an unknown key — deliberately defensive. The picker only ever
	// passes a real `axis.key`, so this is unreachable today; it keeps a future renamed key from
	// throwing rather than silently mislabelling, and the picker's own `selected` state stays honest.
	#axis(key: string): LandscapeAxis {
		return this.axes.find((axis) => axis.key === key) ?? this.axes[0];
	}

	get axisX(): LandscapeAxis {
		return this.#axis(this.#xKey);
	}

	get axisY(): LandscapeAxis {
		return this.#axis(this.#yKey);
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

	get resolution(): number {
		return this.#resolution;
	}

	/** Set the grid resolution, clamped — the store owns this invariant, not the control. */
	setResolution(value: number): void {
		this.#resolution = this.#clampInt(value, LANDSCAPE_DEFAULTS.minRes, LANDSCAPE_DEFAULTS.maxRes);
	}

	get seeds(): number {
		return this.#seeds;
	}

	setSeeds(value: number): void {
		this.#seeds = this.#clampInt(value, LANDSCAPE_DEFAULTS.minSeeds, LANDSCAPE_DEFAULTS.maxSeeds);
	}

	#clampInt(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, Math.round(value) || min));
	}

	/** How many cells the current resolution will measure — shown before a run. */
	get plannedCells(): number {
		return this.#resolution * this.#resolution;
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

	/** The steepest fall-off along X in the current field — the cliff annotation, or null if none. */
	get falloff(): Falloff | null {
		return this.#field ? steepestFalloff(this.#field) : null;
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

	/** Drill into a grid coordinate — opens the cell's world for a closer look. */
	select(ix: number, iy: number): void {
		if (!this.#plan) return;
		this.#selected = this.#plan.cells.find((cell) => cell.ix === ix && cell.iy === iy) ?? null;
	}

	clearSelection(): void {
		this.#selected = null;
	}

	/**
	 * Run the landscape: plan the grid, measure every cell through the batch runner, and keep the
	 * field — unless a newer run superseded this one, in which case `research.run` returns null and
	 * this publishes nothing. Clears any prior drill-in, since the old cell is not in the new grid.
	 */
	async run(executor?: JobExecutor): Promise<void> {
		const base = app.subjectBase('Atlas');
		const plan = planLandscape(base, this.axisX, this.axisY, this.#resolution);
		const jobs = landscapeJobs(plan.cells, {
			seeds: this.#seeds,
			episodes: LANDSCAPE_DEFAULTS.episodes,
			bouts: LANDSCAPE_DEFAULTS.bouts
		});

		const results = await research.run(jobs, executor);
		if (!results) return;

		this.#plan = plan;
		this.#field = landscapeField(plan, results);
		this.#selected = null;
	}

	cancel(): void {
		research.cancel();
	}

	/**
	 * Watch a point on the map evolve: drop its config onto the bench as a fresh, named world and
	 * switch to Studio. The name encodes where on the plane it came from, so the new node is findable.
	 */
	watch(cell: LandscapeCell): void {
		const name = `${this.axisX.label} ${this.axisX.format(cell.x)} · ${this.axisY.label} ${this.axisY.format(cell.y)}`;
		bench.addWorld({ ...cell.cfg, name });
		app.setMode('studio');
	}
}

export const landscape = new LandscapeStore();
