import { describe, it, expect } from 'vitest';
import { makeStoryWorld } from './story';
import { makeWorld, stepWorld } from './world';
import { DEFAULT_WORLDS } from './defaults';
import { seededRng } from './rng';
import type { World } from './types';

function evolvedWorld(seed: number): World {
	const w = makeWorld(DEFAULT_WORLDS[2], undefined, seededRng(seed));
	// evolve a few generations so there is a champion and a curve to carry over
	let steps = 0;
	while (w.gen < 3 && steps < 20000) {
		stepWorld(w, 1 / 60);
		steps++;
	}
	return w;
}

describe('makeStoryWorld', () => {
	it('produces a fresh full generation carrying the source gen, curve, and champion', () => {
		const src = evolvedWorld(11);
		const story = makeStoryWorld(src, seededRng(1));
		expect(story.fish).toHaveLength(src.cfg.prey);
		expect(story.gen).toBe(src.gen);
		expect(story.curve).toEqual(src.curve);
		expect(story.champion).not.toBeNull();
		expect(story.champion!.fitness).toBe(src.champion!.fitness);
		// the copied curve is independent (mutating the story world must not touch src)
		expect(story.curve).not.toBe(src.curve);
	});

	it('is reproducible for a given seed', () => {
		const src = evolvedWorld(11);
		const a = makeStoryWorld(src, seededRng(5));
		const b = makeStoryWorld(src, seededRng(5));
		expect(a.fish.map((f) => [f.x, f.y])).toEqual(b.fish.map((f) => [f.x, f.y]));
	});
});
