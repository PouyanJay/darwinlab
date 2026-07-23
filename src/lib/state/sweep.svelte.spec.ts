import { describe, it, expect, beforeEach } from 'vitest';
import { sweep } from './sweep.svelte';
import { app } from './app.svelte';
import { bench } from './bench.svelte';
import { newWorldConfig } from '../engine';
import type { JobExecutor } from '../lab/runner';
import type { Evaluation } from '../lab/evaluator';
import type { SweepCell } from '../lab/sweep';

/**
 * The design → grid-size logic, kept fast and free of any run. The store is a singleton, so each
 * test restores the catalog defaults first (walking every knob back to its default position),
 * which keeps the tests order-independent under shuffle.
 */

/** An executor that settles every cell without running the engine — the grid is what we assert, not survival. */
class NullExecutor implements JobExecutor {
	readonly concurrency = 1;
	async submit(): Promise<Evaluation | null> {
		return null;
	}
	dispose(): void {}
}

/** Walk every knob and the budget back to the catalog defaults. */
function restoreDefaults(): void {
	app.setMode('studio');
	app.clearSubject();
	app.resetBase();
	for (const knob of sweep.boolKnobs) sweep.setBoolState(knob.key, knob.defaultState);
	for (const knob of sweep.gradedKnobs) {
		for (const value of knob.values) {
			const want = knob.defaultSelected.includes(value);
			if (sweep.isLevelSelected(knob.key, value) !== want) sweep.toggleLevel(knob.key, value);
		}
	}
	sweep.setSeeds(6);
	sweep.setEpisodes(20);
	sweep.setGenDuration(10);
	sweep.setCapOn(false);
	sweep.setCapN(32);
}

describe('sweep design (pin-or-sweep + budget)', () => {
	beforeEach(restoreDefaults);

	it('opens on the default design: 48 cells, uncapped, nothing sampled', () => {
		expect(sweep.plannedCells).toBe(48); // 2³ bools × 3 speeds × 2 prey sizes
		expect(sweep.cellsToRun).toBe(48);
		expect(sweep.willSample).toBe(false);
	});

	it('moving a pinned knob to sweep doubles the factorial', () => {
		expect(sweep.boolState('closing')).toBe('on'); // the state we claim to change starts pinned
		sweep.setBoolState('closing', 'sweep');
		expect(sweep.plannedCells).toBe(96);
	});

	it('a second chip sweeps a graded knob; back to one chip pins it again', () => {
		expect(sweep.isLevelSelected('vision', 240)).toBe(false);
		sweep.toggleLevel('vision', 240); // 200 + 240 → swept
		expect(sweep.plannedCells).toBe(96);
		sweep.toggleLevel('vision', 240); // back to the single 200 chip → pinned
		expect(sweep.plannedCells).toBe(48);
	});

	it('the last chip cannot be deselected — a knob always has a value', () => {
		expect(sweep.isLevelSelected('vision', 200)).toBe(true); // the chip we try to remove is there
		sweep.toggleLevel('vision', 200);
		expect(sweep.isLevelSelected('vision', 200)).toBe(true);
	});

	it('the cap samples the factorial and says so; off, the full design runs', () => {
		sweep.setCapOn(true);
		sweep.setCapN(32);
		expect(sweep.cellsToRun).toBe(32);
		expect(sweep.willSample).toBe(true);
		sweep.setCapOn(false);
		expect(sweep.cellsToRun).toBe(48);
		expect(sweep.willSample).toBe(false);
	});

	it('every budget input clamps — a bad value never reaches a job', () => {
		sweep.setSeeds(999);
		expect(sweep.seeds).toBe(12);
		sweep.setSeeds(-4);
		expect(sweep.seeds).toBe(2);
		sweep.setEpisodes(999);
		expect(sweep.episodes).toBe(120);
		sweep.setEpisodes(1);
		expect(sweep.episodes).toBe(5);
		sweep.setGenDuration(999);
		expect(sweep.genDuration).toBe(60);
		sweep.setGenDuration(1);
		expect(sweep.genDuration).toBe(10);
	});

	it('own-speed is refused off the 8-wire brain, allowed on the 9-wire one', () => {
		expect(app.base.brainInputs ?? 8).toBe(8); // the wiring we refuse on really is the base's
		sweep.setBoolState('speed', 'sweep');
		expect(sweep.boolState('speed')).toBe('off'); // refused, not adopted

		app.setBaseBrainInputs(9);
		sweep.setBoolState('speed', 'sweep');
		expect(sweep.boolState('speed')).toBe('sweep');
		expect(sweep.plannedCells).toBe(96); // it really is a factor now
	});

	it('a stale own-speed sweep collapses at plan time when the brain loses its 9th wire', () => {
		app.setBaseBrainInputs(9);
		sweep.setBoolState('speed', 'sweep');
		expect(sweep.plannedCells).toBe(96); // the state we claim collapses really existed
		app.setBaseBrainInputs(8); // the subject changed under the panel
		expect(sweep.boolState('speed')).toBe('sweep'); // the panel still shows the stale choice…
		expect(sweep.plannedCells).toBe(48); // …but the plan refuses the impossible factor
	});

	it('a large design is confirm-tier, and run() refuses it without the typed cell count', async () => {
		sweep.setSeeds(12);
		sweep.setEpisodes(120);
		sweep.setGenDuration(60); // 48 × 12 × 124 × 60 sim-s ≈ hours at the fallback rate
		expect(sweep.guard).toBe('confirm');

		await sweep.run(new NullExecutor());
		expect(sweep.results).toBeNull(); // refused — nothing was published

		await sweep.run(new NullExecutor(), { confirmedCells: sweep.cellsToRun });
		expect(sweep.cells.length).toBe(48); // the same design, confirmed, runs
	});

	it('the default design sits under the warn tier at the fallback rate', () => {
		expect(sweep.guard).toBe('none');
	});

	it('a test executor settling instantly does NOT calibrate the estimate', async () => {
		expect(sweep.estimateCalibrated).toBe(false); // the state we claim survives really starts false
		await sweep.run(new NullExecutor());
		expect(sweep.estimateCalibrated).toBe(false); // sub-second walls are not prices
	});

	it('a zero-factor design is one honest cell: the pinned world, measured', async () => {
		for (const knob of sweep.boolKnobs) {
			if (sweep.boolState(knob.key) === 'sweep') sweep.setBoolState(knob.key, 'on');
		}
		for (const knob of sweep.gradedKnobs) {
			for (const value of knob.values) {
				if (sweep.isLevelSelected(knob.key, value) && value !== knob.defaultSelected[0])
					sweep.toggleLevel(knob.key, value);
			}
			if (!sweep.isLevelSelected(knob.key, knob.defaultSelected[0]))
				sweep.toggleLevel(knob.key, knob.defaultSelected[0]);
		}
		expect(sweep.plannedCells).toBe(1);
		await sweep.run(new NullExecutor());
		expect(sweep.cells).toHaveLength(1);
	});

	it('runs on the analysis subject when Studio hands one over — its config reaches every cell', async () => {
		// A world with a distinctive vision none of the swept knobs touch (vision stays pinned at
		// its default? no — the pinned vision chip WOULD override; deselect it to the subject's own).
		app.analyze({ ...newWorldConfig('Watched', '#123456'), bh: 333 });
		await sweep.run(new NullExecutor());
		expect(sweep.cells.length).toBeGreaterThan(0); // it really planned and ran a grid
		expect(sweep.cells.every((cell) => cell.cfg.bh === 333)).toBe(true); // the subject's tank, not a default
	});

	it('the pinned choices reach every cell of the run', async () => {
		sweep.setBoolState('walls', 'off'); // pin walls OFF — overriding the generic's on
		await sweep.run(new NullExecutor());
		expect(sweep.cells.length).toBeGreaterThan(0);
		expect(sweep.cells.every((cell) => cell.cfg.senses.walls === false)).toBe(true);
	});

	it('the budget’s generation length reaches every cell as its genDuration', async () => {
		sweep.setGenDuration(20);
		await sweep.run(new NullExecutor());
		expect(sweep.cells.every((cell) => cell.cfg.genDuration === 20)).toBe(true);
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
