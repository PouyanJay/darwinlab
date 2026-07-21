import { describe, it, expect, beforeEach } from 'vitest';
import { landscape } from './landscape.svelte';
import { bench } from './bench.svelte';
import { app } from './app.svelte';
import type { JobExecutor } from '../lab/runner';
import type { Evaluation } from '../lab/evaluator';

/**
 * The Atlas store, driven through a canned executor so the field is fixed and the cliff/selection
 * logic is deterministic (a real landscape is a live measurement — not something to assert). The
 * store is a singleton, so each test restores the default axes, resolution and selection first.
 */

/** Hands back pre-baked evaluations in submit order — one per cell, row-major. */
class CannedExecutor implements JobExecutor {
	readonly concurrency = 1;
	#queue: (Evaluation | null)[];
	constructor(evaluations: (Evaluation | null)[]) {
		this.#queue = [...evaluations];
	}
	async submit(): Promise<Evaluation | null> {
		return this.#queue.shift() ?? null;
	}
	dispose(): void {}
}

const evalMean = (meanReturn: number) => ({ meanReturn }) as unknown as Evaluation;

// A 3×3 field whose columns average 10, 5, 4 — a cliff between columns 0 and 1.
const COLUMN_MEANS = [10, 5, 4];
const cannedField = () =>
	new CannedExecutor(Array.from({ length: 9 }, (_, i) => evalMean(COLUMN_MEANS[i % 3])));

describe('the Atlas store', () => {
	beforeEach(() => {
		landscape.setX('predSpeed');
		landscape.setY('mutation');
		landscape.setResolution(3);
		landscape.setSeeds(2);
		landscape.clearSelection();
		app.setMode('studio');
	});

	it('runs the grid into a field of the canned means', async () => {
		await landscape.run(cannedField());
		const field = landscape.field;
		expect(field?.cols).toBe(3);
		expect(field?.rows).toBe(3);
		expect(field?.values[0]).toBeCloseTo(10); // column 0
		expect(field?.values[1]).toBeCloseTo(5); // column 1
		expect(field?.min).toBeCloseTo(4);
		expect(field?.max).toBeCloseTo(10);
	});

	it('finds the cliff — the steepest fall-off along X', async () => {
		await landscape.run(cannedField());
		expect(landscape.falloff?.ix).toBe(0); // 10 → 5, between columns 0 and 1
		expect(landscape.falloff?.drop).toBeCloseTo(5);
	});

	it('choosing an axis already on the other one swaps them, never plots a knob against itself', () => {
		expect(landscape.axisX.key).toBe('predSpeed'); // the state we claim to change starts here
		landscape.setX('mutation'); // X wants Y's axis
		expect(landscape.axisX.key).toBe('mutation');
		expect(landscape.axisY.key).toBe('predSpeed'); // Y took X's old axis
	});

	it('clamps resolution and seeds so a bad input never sizes a run', () => {
		landscape.setResolution(99);
		expect(landscape.resolution).toBe(8);
		landscape.setResolution(1);
		expect(landscape.resolution).toBe(3);
		landscape.setSeeds(99);
		expect(landscape.seeds).toBe(8);
		landscape.setSeeds(0);
		expect(landscape.seeds).toBe(2);
	});

	it('drills a cell by coordinate and reports its survival, then clears', async () => {
		await landscape.run(cannedField());
		landscape.select(1, 0);
		expect(landscape.selected).toMatchObject({ ix: 1, iy: 0 });
		expect(landscape.selectedValue).toBeCloseTo(5); // column 1's mean

		landscape.clearSelection();
		expect(landscape.selected).toBeNull();
	});

	it('a fresh run clears any prior drill — the old cell is not in the new grid', async () => {
		await landscape.run(cannedField());
		landscape.select(2, 2);
		expect(landscape.selected).not.toBeNull(); // it really was drilled before the rerun
		await landscape.run(cannedField());
		expect(landscape.selected).toBeNull();
	});

	it('watch drops the drilled world onto the bench and switches to Studio', async () => {
		await landscape.run(cannedField());
		landscape.select(2, 0); // predSpeed max, mutation min
		const cell = landscape.selected!;
		const before = bench.worlds.length;
		app.setMode('research'); // the mode we claim watch changes starts here
		expect(app.mode).toBe('research');

		landscape.watch(cell);

		expect(bench.worlds.length).toBe(before + 1);
		expect(app.mode).toBe('studio');
		const added = bench.worlds[bench.worlds.length - 1];
		expect(added.world.cfg.predSpeed).toBeCloseTo(cell.cfg.predSpeed); // the cell's config, not a fresh default
		expect(added.world.cfg.name).toContain('Predator speed'); // named for where it came from
	});
});
