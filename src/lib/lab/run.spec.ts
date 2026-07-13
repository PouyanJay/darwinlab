import { describe, it, expect } from 'vitest';
import { configHash, configDiff, manifest } from './run';
import { DEFAULT_WORLDS } from '../engine';
import type { WorldConfig } from '../engine';

const world = (overrides: Partial<WorldConfig> = {}): WorldConfig => ({
	...structuredClone(DEFAULT_WORLDS[2]),
	...overrides
});

describe('configHash — the fingerprint that lets two people mean the same experiment', () => {
	it('is stable for the same configuration', () => {
		expect(configHash([world()])).toBe(configHash([world()]));
	});

	it('ignores labels: renaming an environment or recolouring it is not a new experiment', () => {
		expect(configHash([world({ name: 'whatever', accent: '#8a5ad8', caption: 'x' })])).toBe(
			configHash([world()])
		);
	});

	it('changes when anything that changes the RUN changes', () => {
		const base = configHash([world()]);
		expect(configHash([world({ predSpeed: 1.4 })])).not.toBe(base);
		expect(configHash([world({ preds: 6 })])).not.toBe(base);
		expect(configHash([world({ persistence: true })])).not.toBe(base);
		expect(
			configHash([world({ senses: { dist: true, dir: false, closing: false, walls: false } })])
		).not.toBe(base);
	});

	it('is six hex characters — short enough to say out loud', () => {
		expect(configHash([world()])).toMatch(/^[0-9a-f]{6}$/);
	});
});

describe('configDiff — what a reader actually needs: how this differs from the baseline', () => {
	it('is empty when nothing was changed', () => {
		expect(configDiff(world(), DEFAULT_WORLDS[2])).toEqual({});
	});

	it('names only what moved', () => {
		const diff = configDiff(world({ preds: 6, predSpeed: 1.4 }), DEFAULT_WORLDS[2]);
		expect(diff).toEqual({ preds: 6, predSpeed: 1.4 });
	});

	it('reads a $state class through its accessors — a spread of one copies NOTHING', () => {
		// The card diffs a Svelte $state class (WorldConfigView), whose fields compile to prototype
		// accessors. configDiff must read keys directly: spreading such an object yields {} and every
		// field reads undefined, which shipped for exactly one commit and made every card claim eight
		// overrides it never had.
		class ViewLike {
			#preds = 6;
			get preds() {
				return this.#preds;
			}
		}
		const view = Object.assign(new ViewLike(), {}) as unknown as WorldConfig;
		const diff = configDiff(view, world());
		expect(diff.preds).toBe(6); // read through the getter, not lost to a spread
	});

	it('resolves engine fallbacks on both sides, so an untouched card reports no overrides', () => {
		// The reactive view fills in the engine's defaults as it projects (persistRamp ?? 0.04) while a
		// stored config leaves them undefined. Compared raw, every card announced three overrides it
		// never had. Both sides are normalised now.
		const view = { ...world(), persistRamp: 0.04, persistMaxBoost: 0.85, persistMaxJaw: 20 };
		const stored = {
			...world(),
			persistRamp: undefined,
			persistMaxBoost: undefined,
			persistMaxJaw: undefined
		};
		expect(configDiff(view, stored)).toEqual({});
	});

	it('ignores what a user cannot change from the UI, so no phantom overrides appear', () => {
		// The reactive view a card diffs against carries only the editable fields. A diff over every
		// field would compare things the view does not have and report an override that is not one.
		expect(configDiff(world({ name: 'renamed', caption: 'x' }), DEFAULT_WORLDS[2])).toEqual({});
	});
});

describe('manifest', () => {
	it('says plainly when a run is NOT reproducible', () => {
		// An unseeded run cannot be handed to anyone. The manifest admits it rather than printing
		// a number that would not reproduce anything.
		expect(manifest(DEFAULT_WORLDS, null, 150).seed).toBeNull();
	});

	it('carries the seed, the episode budget and every environment', () => {
		const m = manifest(DEFAULT_WORLDS, 42, 150);
		expect(m).toMatchObject({ lab: 'darwin-lab', seed: 42, episodes: 150 });
		expect(m.config).toBe(configHash(DEFAULT_WORLDS));
		expect((m.environments as unknown[]).length).toBe(5);
	});
});
