import { describe, it, expect, beforeEach } from 'vitest';
import { landscape } from './landscape.svelte';
import { bench } from './bench.svelte';
import { app } from './app.svelte';
import { newWorldConfig } from '../engine';
import type { JobExecutor } from '../lab/runner';
import type { EvalRequest, Evaluation } from '../lab/evaluator';

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

/** An executor whose jobs never settle on their own — only a cancel (signal abort) resolves them. */
class HangingExecutor implements JobExecutor {
	readonly concurrency = 1;
	submit(
		_req: EvalRequest,
		_onProgress: (fraction: number) => void,
		signal: AbortSignal
	): Promise<Evaluation | null> {
		return new Promise((resolve) => {
			if (signal.aborted) return resolve(null);
			signal.addEventListener('abort', () => resolve(null), { once: true });
		});
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
		app.clearSubject();
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

	it('choosing X already on the Y axis swaps them, never plots a knob against itself', () => {
		expect(landscape.axisX.key).toBe('predSpeed'); // the state we claim to change starts here
		landscape.setX('mutation'); // X wants Y's axis
		expect(landscape.axisX.key).toBe('mutation');
		expect(landscape.axisY.key).toBe('predSpeed'); // Y took X's old axis
	});

	it('choosing Y already on the X axis swaps them too — setY is its own branch', () => {
		expect(landscape.axisY.key).toBe('mutation'); // starts here
		landscape.setY('predSpeed'); // Y wants X's axis
		expect(landscape.axisY.key).toBe('predSpeed');
		expect(landscape.axisX.key).toBe('mutation'); // X took Y's old axis
	});

	it('clamps and rounds resolution and seeds so a bad input never sizes a run', () => {
		landscape.setResolution(99);
		expect(landscape.resolution).toBe(8);
		landscape.setResolution(1);
		expect(landscape.resolution).toBe(3);
		landscape.setResolution(5.6);
		expect(landscape.resolution).toBe(6); // a fractional input rounds, it is not floored
		landscape.setSeeds(99);
		expect(landscape.seeds).toBe(8);
		landscape.setSeeds(0);
		expect(landscape.seeds).toBe(2);
	});

	it('keeps the field on the axes it was measured on when the picker moves after a run', async () => {
		await landscape.run(cannedField()); // measured on predSpeed × mutation
		expect(landscape.field?.axisX.key).toBe('predSpeed'); // it really measured this axis first
		landscape.setX('vision'); // change the live picker AFTER the run (the pickers aren't disabled)
		expect(landscape.axisX.key).toBe('vision'); // the picker moved…
		expect(landscape.field?.axisX.key).toBe('predSpeed'); // …but the measured field's axis is frozen
	});

	it('runs on the analysis subject when Studio hands one over — its config reaches every cell', async () => {
		// A world with a distinctive vision the default axes (predSpeed × mutation) never overwrite.
		app.analyze({ ...newWorldConfig('Watched', '#123456'), vision: 999 });
		await landscape.run(cannedField());
		landscape.select(0, 0);
		expect(landscape.selected?.cfg.vision).toBe(999); // the subject's own vision, not a generic default
	});

	it('a superseded run publishes nothing — the field is the newer run, not the hung one', async () => {
		const first = landscape.run(new HangingExecutor()); // hangs, holding the store
		const second = landscape.run(cannedField()); // aborts the first, then runs to a field
		await second;
		await expect(first).resolves.toBeUndefined(); // the old run resolved, did not throw
		expect(landscape.field?.values[0]).toBeCloseTo(10); // the canned field, not a grid of NaNs
		expect(landscape.field?.min).toBeCloseTo(4); // the second run's range, proving it owns the field
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
