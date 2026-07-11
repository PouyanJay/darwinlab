import { describe, it, expect, afterEach, vi } from 'vitest';
import { bench } from './bench.svelte';
import { DEFAULT_WORLDS } from '../engine';

/**
 * Runs in the browser project (runes need the Svelte compiler). `bench` is a module-level
 * singleton that owns a live loop, so every test tears it down completely — `destroy()` must
 * restore EVERY field, or state leaks between tests through the singleton.
 */
afterEach(() => bench.destroy());

const init = (n = 2, prewarm = 0) =>
	bench.init({ configs: DEFAULT_WORLDS.slice(0, n), prewarmGenerations: prewarm });

/** Drive frames deterministically instead of racing the real 16ms timer. */
const frame = (elapsed = 1 / 60, count = 1) => {
	for (let i = 0; i < count; i++) bench.tick(elapsed);
};

describe('bench store — construction', () => {
	it('builds one world per config with a stats snapshot', () => {
		init(3);
		expect(bench.worlds).toHaveLength(3);
		expect(bench.worlds[0].world.fish.length).toBe(DEFAULT_WORLDS[0].prey);
		expect(bench.worlds[0].stats.gen).toBe(0);
	});

	it('gives every world a unique id', () => {
		init(3);
		const ids = bench.worlds.map((e) => e.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('does not deep-proxy the raw world (the hot path must stay unreactive)', () => {
		init(1);
		const w = bench.worlds[0].world;
		expect(Array.isArray(w.fish)).toBe(true);
		expect(w.fish[0].genome).toBeInstanceOf(Float64Array);
	});

	it('gives each config an isolated copy (editing one world cannot leak into another)', () => {
		init(1);
		bench.addWorld(DEFAULT_WORLDS[0]);
		bench.worlds[0].world.cfg.prey = 99;
		expect(bench.worlds[1].world.cfg.prey).toBe(DEFAULT_WORLDS[0].prey);
		expect(DEFAULT_WORLDS[0].prey).not.toBe(99); // the shared default is untouched
	});
});

describe('bench store — teardown isolation', () => {
	it('destroy() restores every field, so nothing leaks into the next test', () => {
		init(2, 5);
		bench.togglePlay();
		bench.setSpeed(2);
		frame();

		bench.destroy();

		expect(bench.worlds).toEqual([]);
		expect(bench.running).toBe(true); // back to the construction default
		expect(bench.speed).toBe(1);
		expect(bench.turboTarget).toBeNull();
		expect(bench.generationsEvolved).toBe(0);
		expect(bench.painters.size).toBe(0);
	});

	it('stops ticking after destroy (no painters fire, no worlds step)', () => {
		init(1);
		const paint = vi.fn();
		bench.painters.add(paint);

		frame();
		expect(paint).toHaveBeenCalledTimes(1);

		bench.destroy();
		paint.mockClear();
		bench.tick(1 / 60); // even a forced tick must do nothing — there is nothing left
		expect(paint).not.toHaveBeenCalled();
	});
});

describe('bench store — playback', () => {
	it('toggles play', () => {
		init(1);
		expect(bench.running).toBe(true);
		bench.togglePlay();
		expect(bench.running).toBe(false);
	});

	it('sets speed', () => {
		init(1);
		bench.setSpeed(2);
		expect(bench.speed).toBe(2);
	});

	it('advances sim time when running and freezes it when paused', () => {
		init(1);
		const world = bench.worlds[0].world;

		const before = world.t;
		frame(1 / 60, 5);
		expect(world.t).toBeGreaterThan(before);

		bench.togglePlay();
		const paused = world.t;
		frame(1 / 60, 5);
		expect(world.t).toBe(paused); // no sim time passes while paused
	});

	it('advances sim time faster at 2× than at ½×', () => {
		init(1);
		const world = bench.worlds[0].world;

		bench.setSpeed(0.5);
		const t0 = world.t;
		frame(1 / 60, 10);
		const slow = world.t - t0;

		bench.setSpeed(2);
		const t1 = world.t;
		frame(1 / 60, 10);
		const fast = world.t - t1;

		expect(fast).toBeGreaterThan(slow);
		expect(fast / slow).toBeCloseTo(4, 1); // 2× vs ½× → 4× the sim time
	});
});

describe('bench store — turbo / prewarm', () => {
	it('queues a prewarm as a turbo target', () => {
		init(1, 5);
		expect(bench.turboTarget).toBe(5);
	});

	it('trains to the target across frames and then clears the turbo flag', () => {
		init(1, 3);
		for (let i = 0; i < 500 && bench.turboTarget !== null; i++) frame();

		expect(bench.turboTarget).toBeNull(); // finished
		expect(bench.worlds[0].world.gen).toBeGreaterThanOrEqual(3);
		expect(bench.generationsEvolved).toBeGreaterThanOrEqual(3);
	});
});

describe('bench store — stats projection', () => {
	it('refreshes the reactive snapshot from the raw world each frame', () => {
		init(1);
		bench.togglePlay(); // pause: the tick must only PROJECT, not step (a step could eat a fish)
		const { world, stats } = bench.worlds[0];

		world.eaten = 7;
		world.gen = 4;
		world.curve = [0.42];
		frame();

		expect(stats.alive).toBe(world.fish.length);
		expect(stats.eaten).toBe(7);
		expect(stats.gen).toBe(4);
		expect(stats.survivalPct).toBe(42);
		expect(bench.generationsEvolved).toBe(4);
	});
});

describe('bench store — world CRUD', () => {
	it('adds a world', () => {
		init(1);
		bench.addWorld({ ...DEFAULT_WORLDS[2], name: 'Added' });
		expect(bench.worlds).toHaveLength(2);
		expect(bench.worlds[1].world.cfg.name).toBe('Added');
	});

	it('duplicates a world in place, carrying the evolved brains (cloned, not shared)', () => {
		init(1);
		const source = bench.worlds[0];
		const sourceGenome = [...source.world.roster[0].genome];

		bench.duplicateWorld(source.id);
		const copy = bench.worlds[1];

		expect(bench.worlds).toHaveLength(2);
		expect(copy.world.cfg.name).toBe(source.world.cfg.name + ' copy');
		expect([...copy.world.roster[0].genome]).toEqual(sourceGenome);
		expect(copy.world.roster[0].genome).not.toBe(source.world.roster[0].genome);
	});

	it('removes a world', () => {
		init(2);
		const doomed = bench.worlds[0];
		bench.removeWorld(doomed.id);
		expect(bench.worlds).toHaveLength(1);
		expect(bench.find(doomed.id)).toBeUndefined();
	});

	it('stops stepping a removed world (the raw-world cache cannot drift)', () => {
		init(2);
		const doomed = bench.worlds[0].world;
		bench.removeWorld(bench.worlds[0].id);

		const before = doomed.t;
		frame(1 / 60, 5);
		expect(doomed.t).toBe(before); // no longer driven
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

	it('throws on an unknown id rather than silently doing nothing', () => {
		init(1);
		expect(() => bench.resetWorld('nope')).toThrow(/no world with id/);
		expect(() => bench.toggleSense('nope', 'dist')).toThrow(/no world with id/);
	});

	it('hands out an accent no live world is already using', () => {
		init(1);
		const first = bench.worlds[0].world.cfg.accent;
		expect(bench.nextAccent()).not.toBe(first);

		// removing the first world and adding again must not re-issue a colliding accent
		bench.addWorld({ ...DEFAULT_WORLDS[0], accent: bench.nextAccent() });
		bench.removeWorld(bench.worlds[0].id);
		const survivor = bench.worlds[0].world.cfg.accent;
		expect(bench.nextAccent()).not.toBe(survivor);
	});
});

describe('bench store — the only-seam rule', () => {
	it('toggles a sense as a true live ablation', () => {
		init(1);
		const e = bench.worlds[0];
		const before = e.world.cfg.senses.dist;
		bench.toggleSense(e.id, 'dist');
		expect(e.world.cfg.senses.dist).toBe(!before);
	});

	it('routes hover through the store rather than letting components touch the world', () => {
		init(1);
		const e = bench.worlds[0];
		const fish = e.world.fish[0];

		bench.setHover(e.id, fish);
		expect(e.world.hover).toBe(fish);

		bench.setHover(e.id, null);
		expect(e.world.hover).toBeNull();
	});
});

describe('bench store — painters', () => {
	it('calls every registered painter once per frame', () => {
		init(1);
		const a = vi.fn();
		const b = vi.fn();
		bench.painters.add(a);
		bench.painters.add(b);

		frame();
		expect(a).toHaveBeenCalledTimes(1);
		expect(b).toHaveBeenCalledTimes(1);
	});

	it('stops calling a painter once it unregisters', () => {
		init(1);
		const paint = vi.fn();
		const off = bench.painters.add(paint);

		off();
		frame();
		expect(paint).not.toHaveBeenCalled();
	});
});
