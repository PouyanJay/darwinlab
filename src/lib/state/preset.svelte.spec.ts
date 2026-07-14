import { describe, it, expect, afterEach } from 'vitest';
import { bench } from './bench.svelte';
import { DEFAULT_WORLDS, CROWDED_OCEAN, WORLD_LIMITS } from '../engine';

/**
 * The one preset on the bench: crowd the ocean.
 *
 * What is worth pinning is not that it sets two numbers — it is that it sets them THE SAME WAY a
 * hand on the slider does (clamped, applied live, published to the reactive view), and that it does
 * NOT reset the population. The whole point of the preset is to watch a world that has already
 * evolved meet a harsher ocean; a version that quietly wiped the brains would be answering a
 * different question and looking identical while it did.
 */

afterEach(() => bench.destroy());

function benchWithOneWorld() {
	bench.init({ configs: [DEFAULT_WORLDS[2]], prewarmGenerations: 0, maxGenerations: 0 });
	return bench.worlds[0];
}

describe('crowd the ocean', () => {
	it('applies the measured preset — and nothing else', () => {
		const entry = benchWithOneWorld();
		const before = { ...entry.world.cfg };

		bench.crowdTheOcean(entry.id);

		expect(entry.world.cfg.preds).toBe(CROWDED_OCEAN.preds);
		expect(entry.world.cfg.vision).toBe(CROWDED_OCEAN.vision);
		// It is a STAKES preset, not a new world: it must not touch the shark's speed, the mutation
		// rate, the tank, or the senses. Every one of those would change what the comparison means.
		expect(entry.world.cfg.predSpeed).toBe(before.predSpeed);
		expect(entry.world.cfg.mutation).toBe(before.mutation);
		expect(entry.world.cfg.senses).toEqual(before.senses);
		expect(entry.world.cfg.bw).toBe(before.bw);
	});

	it('stays inside the limits the sliders enforce', () => {
		// It goes through setCondition, the same door a hand uses — so the clamp is not optional.
		expect(CROWDED_OCEAN.preds).toBeLessThanOrEqual(WORLD_LIMITS.preds.max);
		expect(CROWDED_OCEAN.vision).toBeLessThanOrEqual(WORLD_LIMITS.vision.max);
	});

	it('reaches the LIVE world, not just the reactive mirror', () => {
		const entry = benchWithOneWorld();
		bench.crowdTheOcean(entry.id);

		// The sharks are really in the water — the trap this repo names by name: asserting the chip
		// updated proves the mirror moved, not that the edit reached the engine.
		expect(entry.world.preds).toHaveLength(CROWDED_OCEAN.preds);
		expect(entry.config.preds).toBe(CROWDED_OCEAN.preds); // …and the card says so too
	});

	it('does NOT wipe what the world has already learned', () => {
		const entry = benchWithOneWorld();
		const dt = 1 / 60;
		for (let i = 0; i < 35 * 60; i++) bench.tick(dt, dt); // one generation (30 sim-seconds)

		const gen = entry.world.gen;
		const champion = entry.world.champion;
		expect(gen).toBeGreaterThan(0);
		expect(champion).not.toBeNull();

		bench.crowdTheOcean(entry.id);

		// The population meets the harder ocean with the brains it already has. That IS the experiment.
		expect(entry.world.gen).toBe(gen);
		expect(entry.world.champion).toBe(champion);
		expect(entry.world.lifeCurve.length).toBeGreaterThan(0);
	});
});
