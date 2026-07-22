import { describe, it, expect, beforeEach } from 'vitest';
import { sweep } from './sweep.svelte';
import { app } from './app.svelte';
import { bench } from './bench.svelte';
import { newWorldConfig } from '../engine';
import type { JobExecutor } from '../lab/runner';
import type { Evaluation } from '../lab/evaluator';
import type { SweepCell } from '../lab/sweep';

/**
 * The selection → grid-size logic, kept fast and free of any run. The store is a singleton, so each
 * test restores the default selection first (toggling only the factors that are out of place), which
 * keeps the tests order-independent under shuffle.
 */
const DEFAULTS = new Set(['dir', 'dist', 'walls', 'predSpeed']);

/** An executor that settles every cell without running the engine — the grid is what we assert, not survival. */
class NullExecutor implements JobExecutor {
	readonly concurrency = 1;
	async submit(): Promise<Evaluation | null> {
		return null;
	}
	dispose(): void {}
}

describe('sweep selection', () => {
	beforeEach(() => {
		for (const factor of sweep.factors) {
			if (sweep.isSelected(factor.key) !== DEFAULTS.has(factor.key)) sweep.toggle(factor.key);
		}
		sweep.setSeeds(6);
		app.setMode('studio');
		app.clearSubject();
	});

	it('starts on a bounded grid under the cap', () => {
		expect(sweep.plannedCells).toBe(24); // dir·dist·walls (2 each) × predSpeed (3)
		expect(sweep.willSample).toBe(false);
	});

	it('a toggle changes the grid size', () => {
		expect(sweep.isSelected('closing')).toBe(false); // the state we claim to change starts here
		sweep.toggle('closing');
		expect(sweep.isSelected('closing')).toBe(true);
		expect(sweep.plannedCells).toBe(48); // ×2 for the new two-level factor
	});

	it('warns when the grid would overflow the cap', () => {
		sweep.toggle('closing'); // → 48
		sweep.toggle('persistence'); // → 96, over the 32 cap
		expect(sweep.plannedCells).toBeGreaterThan(32);
		expect(sweep.willSample).toBe(true);
	});

	it('setSeeds clamps out-of-range values so a bad input never reaches a job', () => {
		sweep.setSeeds(999);
		expect(sweep.seeds).toBe(12);
		sweep.setSeeds(-4);
		expect(sweep.seeds).toBe(2);
		sweep.setSeeds(5);
		expect(sweep.seeds).toBe(5);
	});

	it('runs on the analysis subject when Studio hands one over — its config reaches every cell', async () => {
		// A world with a distinctive vision none of the default factors (senses, predator speed) touch.
		app.analyze({ ...newWorldConfig('Watched', '#123456'), vision: 999 });
		await sweep.run(new NullExecutor());
		expect(sweep.cells.length).toBeGreaterThan(0); // it really planned and ran a grid
		expect(sweep.cells.every((cell) => cell.cfg.vision === 999)).toBe(true); // the subject's vision, not a default
	});
});

describe('sweep drill + watch', () => {
	beforeEach(() => {
		sweep.clearSelection();
		app.setMode('research');
	});

	const cell = (over: Partial<SweepCell> = {}): SweepCell => ({
		index: 0,
		levels: { dir: 'on' },
		cfg: { ...newWorldConfig('cell', '#123456'), predSpeed: 3.3 },
		...over
	});

	it('select opens a cell and clearSelection closes it', () => {
		expect(sweep.selected).toBeNull();
		sweep.select(2, 1);
		expect(sweep.selected).toEqual({ condition: 2, seed: 1 });
		sweep.clearSelection();
		expect(sweep.selected).toBeNull();
	});

	it('watch drops the condition onto the bench, named for its levels, and switches to Studio', () => {
		const before = bench.worlds.length;

		sweep.watch(cell());

		expect(bench.worlds.length).toBe(before + 1);
		expect(app.mode).toBe('studio');
		const added = bench.worlds[bench.worlds.length - 1];
		expect(added.world.cfg.predSpeed).toBeCloseTo(3.3); // the cell's config, not a fresh default
		expect(added.world.cfg.name).toContain('Direction on'); // the factor LABEL, not the key 'dir'
	});

	it('names a cell that varied no factor plainly, rather than an empty string', () => {
		sweep.watch(cell({ levels: {} }));
		const added = bench.worlds[bench.worlds.length - 1];
		expect(added.world.cfg.name).toBe('Sweep world');
	});
});
