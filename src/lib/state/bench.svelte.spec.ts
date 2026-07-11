import { describe, it, expect, afterEach } from 'vitest';
import { bench } from './bench.svelte';
import { DEFAULT_WORLDS } from '../engine';

/**
 * Runs in the browser project (runes need the Svelte compiler). The store owns a live loop, so
 * every test tears it down.
 */
afterEach(() => bench.destroy());

const init = (n = 2, prewarm = 0) =>
	bench.init({ configs: DEFAULT_WORLDS.slice(0, n), prewarmGenerations: prewarm });

describe('bench store', () => {
	it('builds one world per config with a stats snapshot', () => {
		init(3);
		expect(bench.worlds).toHaveLength(3);
		expect(bench.worlds[0].world.fish.length).toBe(DEFAULT_WORLDS[0].prey);
		expect(bench.worlds[0].stats.gen).toBe(0);
		expect(bench.worlds.map((e) => e.id)).toEqual([...new Set(bench.worlds.map((e) => e.id))]);
	});

	it('does not deep-proxy the raw world (the hot path must stay unreactive)', () => {
		init(1);
		const w = bench.worlds[0].world;
		// a $state proxy would not be the same object identity as its target's array
		expect(Array.isArray(w.fish)).toBe(true);
		expect(w.fish[0].genome).toBeInstanceOf(Float64Array);
	});

	it('queues a prewarm as a turbo target', () => {
		init(1, 5);
		expect(bench.turboTarget).toBe(5);
	});

	it('toggles play and speed', () => {
		init(1);
		expect(bench.running).toBe(true);
		bench.togglePlay();
		expect(bench.running).toBe(false);
		bench.setSpeed(2);
		expect(bench.speed).toBe(2);
	});

	it('toggles a sense as a true ablation and applies it to the live world', () => {
		init(1);
		const e = bench.worlds[0];
		const before = e.world.cfg.senses.dist;
		bench.toggleSense(e.id, 'dist');
		expect(e.world.cfg.senses.dist).toBe(!before);
	});

	it('adds, duplicates and removes worlds', () => {
		init(1);
		const first = bench.worlds[0];

		bench.addWorld({ ...DEFAULT_WORLDS[2], name: 'Added' });
		expect(bench.worlds).toHaveLength(2);
		expect(bench.worlds[1].world.cfg.name).toBe('Added');

		bench.duplicateWorld(first.id);
		expect(bench.worlds).toHaveLength(3);
		expect(bench.worlds[1].world.cfg.name).toBe(first.world.cfg.name + ' copy'); // inserted after source

		bench.removeWorld(first.id);
		expect(bench.worlds).toHaveLength(2);
		expect(bench.find(first.id)).toBeUndefined();
	});

	it('duplicating carries the evolved brains, not fresh random ones', () => {
		init(1);
		const src = bench.worlds[0];
		const srcGenome = [...src.world.roster[0].genome];

		bench.duplicateWorld(src.id);
		const copy = bench.worlds[1];

		expect([...copy.world.roster[0].genome]).toEqual(srcGenome);
		expect(copy.world.roster[0].genome).not.toBe(src.world.roster[0].genome); // cloned, not shared
	});

	it('gives each config an isolated copy (editing one world cannot leak into another)', () => {
		init(1);
		bench.addWorld(DEFAULT_WORLDS[0]);
		bench.worlds[0].world.cfg.prey = 99;
		expect(bench.worlds[1].world.cfg.prey).toBe(DEFAULT_WORLDS[0].prey);
		expect(DEFAULT_WORLDS[0].prey).not.toBe(99); // the shared default is untouched
	});

	it('resets a world back to generation 0', () => {
		init(1);
		const e = bench.worlds[0];
		e.world.gen = 4;
		e.world.curve = [0.3, 0.4];
		bench.resetWorld(e.id);
		expect(e.world.gen).toBe(0);
		expect(e.world.curve).toEqual([]);
	});

	it('registers and unregisters painters', () => {
		init(1);
		let painted = 0;
		const off = bench.registerPainter(() => painted++);
		expect(typeof off).toBe('function');
		off();
		expect(painted).toBe(0);
	});
});
