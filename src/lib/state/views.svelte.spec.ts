import { describe, it, expect } from 'vitest';
import { EscapeMapView } from './views.svelte';
import { makeGenome } from '../engine/network';
import { seededRng } from '../engine/rng';
import { testCfg, testFish } from '../engine/testkit';
import type { World } from '../engine';

/** A minimal world for the view: syncFrom reads only `selFish` and `cfg`. */
function world(over: Partial<World> & { selFish: World['selFish'] }): World {
	return { cfg: testCfg(), ...over } as unknown as World;
}

describe('EscapeMapView — the memoised escape map', () => {
	it('computes a map for the selected fish', () => {
		const view = new EscapeMapView();
		view.syncFrom(world({ selFish: testFish() }));
		expect(view.map).not.toBeNull();
		expect(view.map!.samples.length).toBeGreaterThan(0);
	});

	it('does NOT recompute when nothing has changed — the whole point of the memo', () => {
		// Reference identity is the proof: a skipped recompute returns the SAME object; a redundant
		// one returns a fresh grid. Sabotage: drop the signature guard and this fails every frame.
		const view = new EscapeMapView();
		const w = world({ selFish: testFish() });
		view.syncFrom(w);
		const first = view.map;
		view.syncFrom(w);
		expect(view.map).toBe(first);
	});

	it('recomputes when the genome changes (a champion heir, a new pick)', () => {
		const view = new EscapeMapView();
		view.syncFrom(world({ selFish: testFish({ genome: makeGenome(seededRng(1)) }) }));
		const first = view.map;
		view.syncFrom(world({ selFish: testFish({ genome: makeGenome(seededRng(2)) }) }));
		expect(view.map).not.toBe(first);
	});

	it('recomputes when a sense is cut, though the fish is the same', () => {
		const view = new EscapeMapView();
		const fish = testFish();
		view.syncFrom({ cfg: testCfg(), selFish: fish } as unknown as World);
		const wired = view.map;
		view.syncFrom({
			cfg: testCfg({ senses: { dist: false, dir: false, closing: false, walls: false } }),
			selFish: fish
		} as unknown as World);
		expect(view.map).not.toBe(wired);
	});

	it('recomputes when the tank is resized — the agent sits at its centre, feeding the wall rays', () => {
		// Guards the signature actually covering bw/bh: with walls on, tank size shifts the wall
		// inputs, so a resize that did not invalidate the memo would leave a stale map.
		const view = new EscapeMapView();
		const fish = testFish();
		view.syncFrom({ cfg: testCfg(), selFish: fish } as unknown as World);
		const before = view.map;
		view.syncFrom({ cfg: testCfg({ bw: 320, bh: 200 }), selFish: fish } as unknown as World);
		expect(view.map).not.toBe(before);
	});

	it('clears to null on deselect, and a re-pick of the SAME fish recomputes (not stuck null)', () => {
		// The clear() must reset the memo key too, or re-selecting the same genome would be skipped
		// against a null map and the panel would open blank.
		const view = new EscapeMapView();
		const fish = testFish();
		view.syncFrom(world({ selFish: fish }));
		expect(view.map).not.toBeNull();

		view.syncFrom(world({ selFish: null }));
		expect(view.map).toBeNull();

		view.syncFrom(world({ selFish: fish }));
		expect(view.map).not.toBeNull();
	});
});
