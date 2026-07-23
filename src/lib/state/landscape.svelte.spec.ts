import { describe, it, expect, beforeEach } from 'vitest';
import { landscape, EDGE_DROP_SECONDS } from './landscape.svelte';
import {
	restoreLandscapeDefaults,
	CannedExecutor,
	HangingExecutor,
	evalMean
} from './landscape.testkit';
import { bench } from './bench.svelte';
import { app } from './app.svelte';
import { newWorldConfig } from '../engine';

/**
 * The Atlas store, driven through a canned executor so the field is fixed and the cliff/selection
 * logic is deterministic (a real landscape is a live measurement — not something to assert). The
 * store is a singleton, so each test walks the whole design back to the defaults first.
 */

// A 5×5 field whose columns average 10, 5, 4, 3, 2 — a cliff between columns 0 and 1.
const COLUMN_MEANS = [10, 5, 4, 3, 2];
const cannedField = () =>
	new CannedExecutor(Array.from({ length: 25 }, (_, i) => evalMean(COLUMN_MEANS[i % 5])));

describe('the Atlas store', () => {
	beforeEach(() => {
		restoreLandscapeDefaults();
		landscape.setResolution(5);
		landscape.setSeeds(2);
		app.setMode('studio');
	});

	it('runs the grid into a field of the canned means', async () => {
		await landscape.run(cannedField());
		const field = landscape.field;
		expect(field?.cols).toBe(5);
		expect(field?.rows).toBe(5);
		expect(field?.values[0]).toBeCloseTo(10); // column 0
		expect(field?.values[1]).toBeCloseTo(5); // column 1
		expect(field?.min).toBeCloseTo(2);
		expect(field?.max).toBeCloseTo(10);
	});

	it('finds the cliff — the steepest fall-off along X', async () => {
		await landscape.run(cannedField());
		expect(landscape.falloff?.ix).toBe(0); // 10 → 5, between columns 0 and 1
		expect(landscape.falloff?.drop).toBeCloseTo(5);
	});

	it('traces each row its own cliff — the gold dashes read off the same field', async () => {
		await landscape.run(cannedField());
		// every canned row falls hardest between columns 0 and 1
		expect(landscape.cliffRows).toHaveLength(5);
		for (const cliff of landscape.cliffRows) expect(cliff?.ix).toBe(0);
	});

	it('serves the cross-section rows — the Y extremes as curves', async () => {
		await landscape.run(cannedField());
		const sections = landscape.sections;
		expect(sections).toHaveLength(2);
		expect(sections[0].y).toBeCloseTo(0.02); // mutation min (the bottom row)
		expect(sections[1].y).toBeCloseTo(0.14); // mutation max (the top row)
		expect(sections[0].points.map((p) => p.survival)).toEqual(COLUMN_MEANS);
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

	it('remembers an edited range PER AXIS — swap away and back, the range is still yours', () => {
		landscape.setSpan('predSpeed', 0.8, 1.1);
		expect(landscape.axisX.min).toBeCloseTo(0.8);
		landscape.setX('vision'); // leave the axis…
		landscape.setX('predSpeed'); // …and come back
		expect(landscape.axisX.min).toBeCloseTo(0.8); // the edit survived the round trip
		expect(landscape.axisX.max).toBeCloseTo(1.1);
	});

	it('normalises a span through the lab rules — clamped, ordered, degenerate resets', () => {
		landscape.setSpan('predSpeed', 1.9, 0.3); // inverted AND out of bounds
		expect(landscape.axisX.min).toBeCloseTo(0.6);
		expect(landscape.axisX.max).toBeCloseTo(1.4);
	});

	it('snaps an off-menu resolution to the nearest option, never a free integer', () => {
		landscape.setResolution(99);
		expect(landscape.resolution).toBe(9);
		landscape.setResolution(1);
		expect(landscape.resolution).toBe(5);
		landscape.setResolution(6.9);
		expect(landscape.resolution).toBe(7);
	});

	it('clamps seeds to the budget limits', () => {
		landscape.setSeeds(99);
		expect(landscape.seeds).toBe(10);
		landscape.setSeeds(0);
		expect(landscape.seeds).toBe(2);
	});

	it('clamps generations to the budget limits', () => {
		landscape.setEpisodes(999);
		expect(landscape.episodes).toBe(60);
		landscape.setEpisodes(1);
		expect(landscape.episodes).toBe(5);
	});

	it('an untouched pin follows the subject; an explicit pin reaches every measured cell', async () => {
		expect(landscape.pin('persistence')).toBe(false); // the generic ocean's own truth
		landscape.setPin('persistence', true);
		await landscape.run(cannedField());
		landscape.select(0, 0);
		expect(landscape.selected?.cfg.persistence).toBe(true); // the pin reached the cell's config
	});

	it('prices the plan by its training length — longer costs more', () => {
		expect(landscape.estimatedSeconds).toBeGreaterThan(0);
		landscape.setEpisodes(40);
		const dearer = landscape.estimatedSeconds;
		landscape.setEpisodes(20);
		expect(dearer).toBeGreaterThan(landscape.estimatedSeconds);
	});

	it('freezes the receipt with the run — what the tiles print is the measured budget', async () => {
		await landscape.run(cannedField());
		expect(landscape.receipt).toMatchObject({ seeds: 2, episodes: 20 });
		expect(landscape.receipt!.wallSeconds).toBeGreaterThanOrEqual(0);
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
		expect(landscape.field?.min).toBeCloseTo(2); // the second run's range, proving it owns the field
	});

	it('drills a cell by coordinate and reports its survival, then clears', async () => {
		await landscape.run(cannedField());
		landscape.select(1, 0);
		expect(landscape.selected).toMatchObject({ ix: 1, iy: 0 });
		expect(landscape.selectedValue).toBeCloseTo(5); // column 1's mean

		landscape.clearSelection();
		expect(landscape.selected).toBeNull();
	});

	it('reads the neighbours — the drop to the right, the flat step up, the map edge', async () => {
		await landscape.run(cannedField());
		landscape.select(0, 0);
		expect(landscape.neighborDelta(1, 0)).toBeCloseTo(-5); // one step right falls off the cliff
		expect(Math.abs(landscape.neighborDelta(1, 0)!)).toBeGreaterThan(EDGE_DROP_SECONDS);
		expect(landscape.neighborDelta(0, 1)).toBeCloseTo(0); // every row is the same canned curve
		landscape.select(4, 4); // the far corner
		expect(landscape.neighborDelta(1, 0)).toBeNull(); // the map's edge, not a fake zero
		expect(landscape.neighborDelta(0, 1)).toBeNull();
	});

	it('reports the map edge on a SINGLE axis — no wrap into the next row', async () => {
		// The sabotage that found this: dropping the ix >= cols bound made a right-edge cell read the
		// NEXT ROW's first value through the flat index. The double corner can't catch that (its index
		// falls off the array's end either way) — only a one-axis edge distinguishes the guard.
		await landscape.run(cannedField());
		landscape.select(4, 2); // the right edge, an interior row
		expect(landscape.neighborDelta(1, 0)).toBeNull(); // off the map, not row 3's first cell
		expect(landscape.neighborDelta(0, 1)).not.toBeNull(); // the same cell still has an up-neighbour
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
		landscape.select(4, 0); // predSpeed max, mutation min
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
