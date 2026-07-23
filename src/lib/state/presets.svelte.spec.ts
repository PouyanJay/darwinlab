import { describe, it, expect, beforeEach } from 'vitest';
import { presets, loadPresets, PRESETS_STORAGE_KEY } from './presets.svelte';
import { app } from './app.svelte';

/**
 * The presets store is a singleton over localStorage; every test empties both the storage and the
 * in-memory list (by removing whatever a previous test saved), so each starts from a known blank.
 */
describe('base presets', () => {
	beforeEach(() => {
		localStorage.removeItem(PRESETS_STORAGE_KEY);
		for (const p of [...presets.entries]) presets.remove(p.name);
		app.clearSubject();
		app.resetBase();
	});

	it('saveCurrent snapshots the current base under its name and persists it', () => {
		app.renameBase('Reef');
		app.setBaseCondition('prey', 36);
		presets.saveCurrent();

		expect(presets.entries).toHaveLength(1);
		expect(presets.entries[0].name).toBe('Reef');
		expect(presets.entries[0].cfg.prey).toBe(36);
		// and it really reached storage — a fresh load sees it
		expect(loadPresets()[0]?.name).toBe('Reef');
	});

	it('saving again under the same name replaces, not duplicates', () => {
		app.renameBase('Reef');
		app.setBaseCondition('prey', 20);
		presets.saveCurrent();
		app.setBaseCondition('prey', 44);
		presets.saveCurrent();

		expect(presets.entries).toHaveLength(1);
		expect(presets.entries[0].cfg.prey).toBe(44);
	});

	it('apply adopts the preset as the base — and drops an analysed subject', () => {
		app.renameBase('Reef');
		app.setBaseCondition('prey', 36);
		presets.saveCurrent();
		app.resetBase();
		expect(app.base.prey).not.toBe(36); // the base really left the preset's shape

		app.analyze({ ...app.subjectBase('Watched'), prey: 12 });
		presets.apply('Reef');

		expect(app.subject).toBeNull();
		expect(app.base.prey).toBe(36);
	});

	it('apply on an unknown name is a no-op', () => {
		const before = app.base;
		presets.apply('does-not-exist');
		expect(app.base).toBe(before);
	});

	it('remove deletes the preset and persists the deletion', () => {
		presets.saveCurrent();
		expect(presets.entries).toHaveLength(1); // it really was saved before we remove it
		presets.remove(presets.entries[0].name);
		expect(presets.entries).toHaveLength(0);
		expect(loadPresets()).toHaveLength(0);
	});

	it('loadPresets drops garbage instead of throwing', () => {
		localStorage.setItem(PRESETS_STORAGE_KEY, 'not json');
		expect(loadPresets()).toEqual([]);
		localStorage.setItem(
			PRESETS_STORAGE_KEY,
			JSON.stringify({ version: 1, entries: [{ name: 3 }, null, 'x'] })
		);
		expect(loadPresets()).toEqual([]);
	});
});
