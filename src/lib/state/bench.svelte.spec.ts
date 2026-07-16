import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushSync } from 'svelte';
import { bench } from './bench.svelte';
import { DEFAULT_WORLDS, WORLD_LIMITS, MAX_GENERATIONS, ACCENTS, seededRng } from '../engine';
import { BRANCH_DROP } from '../lab/lineage';

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
		// the LIFE curve is what the tiles plot and what this projects — mean seconds survived as a
		// share of the generation, which is what selection actually rewards (see World.lifeCurve)
		world.lifeCurve = [0.42];
		frame();

		expect(stats.alive).toBe(world.fish.length);
		expect(stats.eaten).toBe(7);
		expect(stats.gen).toBe(4);
		expect(stats.survivalPct).toBe(42);
		expect(bench.generationsEvolved).toBe(4);
	});

	it('projects the deployment half too — the tile reads its whole real-world run from here', () => {
		init(1);
		bench.togglePlay(); // pause: project only, do not step
		const { world, stats } = bench.worlds[0];

		world._deployed = true;
		world.deployT = 31.5;
		world.halfLife = 12.4;
		world.extinctT = 47.8;
		world.champion = { genome: world.fish[0].genome, fitness: 9.25, gen: 3 };
		frame();

		expect(stats.deployed).toBe(true);
		expect(stats.deployT).toBe(31.5);
		expect(stats.halfLife).toBe(12.4);
		expect(stats.extinctT).toBe(47.8);
		expect(stats.championFitness).toBe(9.25);
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

describe('bench store — lineage & branch', () => {
	it('lays the launched worlds out as a row of unbranched roots', () => {
		init(3);
		const xs = bench.worlds.map((e) => e.lineage.x);
		expect(new Set(xs).size).toBe(3); // three distinct columns, left to right
		expect(xs[0]).toBeLessThan(xs[1]);
		expect(xs[1]).toBeLessThan(xs[2]);
		expect(bench.worlds.every((e) => e.lineage.y === 0)).toBe(true);
		expect(bench.worlds.every((e) => e.lineage.parentId === null)).toBe(true);
	});

	it('branches a wired child that inherits the parent brains and generation; parent untouched', () => {
		init(1);
		const parent = bench.worlds[0];
		parent.world.gen = 7;
		const parentGenome = [...parent.world.roster[0].genome];

		const childId = bench.branchWorld(parent.id);
		const child = bench.find(childId)!;

		expect(bench.worlds).toHaveLength(2);
		expect(child.lineage.parentId).toBe(parent.id);
		expect(parent.lineage.childIds).toContain(childId);
		expect(child.world.gen).toBe(7); // started where the parent is, not at gen 0
		expect([...child.world.roster[0].genome]).toEqual(parentGenome);
		expect(child.world.roster[0].genome).not.toBe(parent.world.roster[0].genome); // cloned, not shared
		// the parent is neither reset nor re-linked by the fork
		expect(parent.lineage.parentId).toBeNull();
		expect(parent.world.gen).toBe(7);
	});

	it('drops the child below its parent and opens its Conditions to change one thing', () => {
		init(1);
		const parent = bench.worlds[0];
		const child = bench.find(bench.branchWorld(parent.id))!;
		expect(child.lineage.y).toBe(parent.lineage.y + BRANCH_DROP);
		expect(bench.conditionsWorldId).toBe(child.id); // the "change one thing" dialog is open on it
	});

	it('fans successive siblings sideways so they do not stack on one line', () => {
		init(1);
		const parent = bench.worlds[0];
		// branchWorld opens the child's Conditions; close it between forks just to model the real flow
		// (the dialog state doesn't affect branching — this is housekeeping, not a precondition).
		const a = bench.find(bench.branchWorld(parent.id))!;
		bench.closeConditions();
		const b = bench.find(bench.branchWorld(parent.id))!;
		expect(parent.lineage.childIds).toHaveLength(2);
		expect(b.lineage.x).toBeGreaterThan(a.lineage.x);
	});

	it('moveWorld slides a node without touching the sim', () => {
		init(1);
		const e = bench.worlds[0];
		const t = e.world.t;
		bench.moveWorld(e.id, 321, 654);
		expect(e.lineage.x).toBe(321);
		expect(e.lineage.y).toBe(654);
		expect(e.world.t).toBe(t); // pure view state — no genome, fitness or clock moved
	});

	it('removing a world prunes the lineage wires it touched', () => {
		init(1);
		const parent = bench.worlds[0];
		const childId = bench.branchWorld(parent.id);
		bench.closeConditions();
		const grandId = bench.branchWorld(childId); // parent → child → grandchild
		bench.closeConditions();

		bench.removeWorld(childId);
		// the parent no longer lists the child that is gone…
		expect(parent.lineage.childIds).not.toContain(childId);
		// …and the grandchild is orphaned into a root rather than pointing at a world that vanished
		expect(bench.find(grandId)!.lineage.parentId).toBeNull();
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

describe('bench store — painting only when something changed', () => {
	/** Pause and drain the repaint owed by init itself, so each test starts from a quiet bench. */
	const initPaused = (n = 1) => {
		init(n);
		bench.togglePlay();
		frame();
	};

	it('does not repaint a paused, untouched bench', () => {
		initPaused();
		const paint = vi.fn();
		bench.painters.add(paint);

		frame(1 / 60, 5);
		expect(paint).not.toHaveBeenCalled();
	});

	it('repaints exactly once after an interaction while paused', () => {
		initPaused();
		const entry = bench.worlds[0];
		const paint = vi.fn();
		bench.painters.add(paint);

		bench.setHover(entry.id, entry.world.fish[0]);
		frame(1 / 60, 5);
		expect(paint).toHaveBeenCalledTimes(1); // the hover ring appears — then quiet again
	});

	it('an unchanged hover does not wake a paused bench — mousemove fires at pointer rate', () => {
		initPaused();
		const entry = bench.worlds[0];
		const paint = vi.fn();
		bench.painters.add(paint);

		bench.setHover(entry.id, null); // the pointer is over empty water, again
		frame(1 / 60, 5);
		expect(paint).not.toHaveBeenCalled();
	});

	it('keeps painting while training even though playback is paused', () => {
		initPaused();
		const paint = vi.fn();
		bench.painters.add(paint);

		bench.trainTo(50); // far more than three 15ms slices can finish
		frame(1 / 60, 3);
		expect(paint).toHaveBeenCalledTimes(3); // the turbo progress is the picture
	});

	it('downgrades the story detail after sustained slow frames', () => {
		init(1);
		expect(bench.detail).toBe('cinematic');
		for (let i = 0; i < 200; i++) bench.tick(1 / 60, 0.04); // 25fps, honestly reported
		expect(bench.detail).toBe('performance');
	});

	it('never judges TRAINING frames — turbo is slow by design, not a struggling machine', () => {
		init(1);
		bench.trainTo(9999); // far more than this test will ever finish
		expect(bench.turboTarget).not.toBeNull(); // the state under test actually holds

		// every turbo frame deliberately burns its 15ms slice, and honestly reported that reads
		// as ~31ms — past the downgrade line; the governor must not be listening
		for (let i = 0; i < 60 && bench.turboTarget !== null; i++) bench.tick(1 / 60, 0.031);
		expect(bench.turboTarget).not.toBeNull(); // it did not finish out from under the test
		expect(bench.detail).toBe('cinematic');
	});

	it('a paused tick does not advance the sim — pause stops the WORLD, not just the paint', () => {
		init(1);
		bench.togglePlay();
		const t = bench.worlds[0].world.t;
		frame(1 / 60, 10);
		expect(bench.worlds[0].world.t).toBe(t);
	});

	it('paints the story group and lets the covered bench sleep while a film plays', () => {
		init(2);
		const benchPaint = vi.fn();
		const storyPaint = vi.fn();
		bench.painters.add(benchPaint);
		bench.painters.add(storyPaint, 'story');
		frame(); // drain the repaint owed by init, while still on the bench
		benchPaint.mockClear();
		storyPaint.mockClear();

		expect(bench.playStory()).toBe(true);
		frame(1 / 60, 3);
		expect(storyPaint).toHaveBeenCalledTimes(3);
		expect(benchPaint).not.toHaveBeenCalled();

		bench.exitStory();
		frame();
		expect(benchPaint).toHaveBeenCalledTimes(1); // the bench wakes with a repaint owed
	});

	it("an 'always' painter rides over both contexts (the inspector works mid-film)", () => {
		init(2);
		const paint = vi.fn();
		bench.painters.add(paint, 'always');

		frame();
		expect(paint).toHaveBeenCalledTimes(1);

		expect(bench.playStory()).toBe(true);
		frame();
		expect(paint).toHaveBeenCalledTimes(2);
	});
});

describe('bench store — keyboard creature cycling', () => {
	/** A tiny world with a known census: 3 fish then 1 shark, so the walk order is checkable. */
	const initCountable = () =>
		bench.init({ configs: [{ ...structuredClone(DEFAULT_WORLDS[0]), prey: 3, preds: 1 }] });

	it('enters at the first fish and walks forward, hand-picked', () => {
		initCountable();
		const e = bench.worlds[0];

		bench.cycleSelection(e.id, 1);
		expect(e.world.selFish).toBe(e.world.fish[0]);
		expect(bench.selection).toEqual({ worldId: e.id, type: 'fish', followsChampion: false });

		bench.cycleSelection(e.id, 1);
		expect(e.world.selFish).toBe(e.world.fish[1]);
	});

	it('enters at the shark walking backward, and wraps around both ends', () => {
		initCountable();
		const e = bench.worlds[0];

		bench.cycleSelection(e.id, -1); // the predator stop sits last, so backwards enters there
		expect(bench.selection?.type).toBe('pred');

		bench.cycleSelection(e.id, 1); // one past the shark wraps to the first fish
		expect(e.world.selFish).toBe(e.world.fish[0]);

		bench.cycleSelection(e.id, -1); // and one back from the first fish is the shark again
		expect(bench.selection?.type).toBe('pred');
	});

	it('a pack of sharks is ONE stop — the walk can always get past them', () => {
		initCountable();
		const e = bench.worlds[0];
		// The engine's documented fidelity quirk: a fresh world opens gen 0 with 2× predators.
		// That is exactly the state this test needs, so assert it actually holds.
		expect(e.world.preds.length).toBeGreaterThan(1);

		bench.cycleSelection(e.id, -1); // onto the predator stop
		expect(bench.selection?.type).toBe('pred');
		bench.cycleSelection(e.id, 1); // one step must LEAVE the pack, not walk shark to shark
		expect(bench.selection?.type).toBe('fish');
		expect(e.world.selFish).toBe(e.world.fish[0]);
	});

	it('walks from wherever the champion selection stood, and hands over to a hand-pick', () => {
		initCountable();
		const e = bench.worlds[0];
		bench.selectChampion(e.id);
		const champion = e.world.selFish!;
		const at = e.world.fish.indexOf(champion);

		bench.cycleSelection(e.id, 1);

		const expected = at === e.world.fish.length - 1 ? null : e.world.fish[at + 1];
		if (expected) expect(e.world.selFish).toBe(expected);
		else expect(bench.selection?.type).toBe('pred'); // the champion was last — next is the shark
		expect(bench.selection?.followsChampion).toBe(false);
	});

	it('does nothing at all in an empty tank', () => {
		initCountable();
		const e = bench.worlds[0];
		e.world.fish.length = 0; // a deployed world after the last catch
		e.world.preds.length = 0;

		bench.cycleSelection(e.id, 1);
		expect(bench.selection).toBeNull();
	});

	it('a shark selection whose sharks were removed cannot block the walk', () => {
		initCountable();
		const e = bench.worlds[0];
		bench.cycleSelection(e.id, -1); // onto the predator stop
		expect(bench.selection?.type).toBe('pred');

		bench.setCondition(e.id, 'preds', 0); // Conditions can empty the water of sharks, live

		bench.cycleSelection(e.id, 1); // before any tick has reconciled the stale selection
		expect(e.world.selFish).toBe(e.world.fish[0]); // enters at the FIRST fish, skips nothing
	});

	it('a shark selection whose sharks were removed is put down at the next tick', () => {
		initCountable();
		const e = bench.worlds[0];
		bench.cycleSelection(e.id, -1);
		expect(bench.selection?.type).toBe('pred');

		bench.setCondition(e.id, 'preds', 0);
		frame();

		expect(bench.selection).toBeNull(); // the inspector never presents a shark not in the water
	});

	it('ignores a selection that lives in a different world', () => {
		bench.init({
			configs: [0, 1].map((i) => ({ ...structuredClone(DEFAULT_WORLDS[i]), prey: 3, preds: 1 }))
		});
		const [a, b] = bench.worlds;
		bench.cycleSelection(a.id, 1);
		expect(a.world.selFish).toBe(a.world.fish[0]);

		bench.cycleSelection(b.id, 1); // must enter b at ITS first fish, not continue a's walk
		expect(b.world.selFish).toBe(b.world.fish[0]);
		expect(a.world.selFish).toBeNull(); // one inspector: the old selection was put down
	});
});

describe('bench store — selection', () => {
	/**
	 * A world with no predators, so nothing can be eaten.
	 *
	 * The generation-turnover tests need the watched fish to survive UP TO the turnover, or they
	 * quietly exercise the eaten path instead — and the default first world, "Blind drift", is
	 * exactly the one whose population really does get wiped out. Removing the sharks makes the
	 * turnover the only thing that can end a fish's life, which is what these tests are about.
	 * (The wipe-out case gets a test of its own below.)
	 */
	const initSafeWorld = () =>
		bench.init({ configs: [{ ...structuredClone(DEFAULT_WORLDS[2]), preds: 0 }] });

	/**
	 * Fast-forward one world to the moment just after its generation turns over.
	 *
	 * Budgeted: if a regression ever stalls the generation boundary, this fails with a clear message
	 * instead of hanging the whole suite.
	 */
	const runToNextGeneration = (id: string) => {
		const { world } = bench.entry(id);
		const target = world.gen + 1;
		let steps = 0;
		while (world.gen < target) {
			frame(1 / 60);
			if (++steps > 20_000) throw new Error('the generation never turned over');
		}
	};

	it('inspects the fish that was clicked, and fills in its mind straight away', () => {
		init(1);
		const { id, world } = bench.worlds[0];

		bench.select(id, { type: 'fish', obj: world.fish[3] });

		expect(bench.selection).toEqual({ worldId: id, type: 'fish', followsChampion: false });
		expect(world.selFish).toBe(world.fish[3]);
		// populated NOW, not on the next tick — the sim may well be paused
		expect(world.sense).not.toBeNull();
	});

	it('holds one selection across the whole bench, because there is one inspector', () => {
		init(2);
		const [first, second] = bench.worlds;

		bench.select(first.id, { type: 'fish', obj: first.world.fish[0] });
		bench.select(second.id, { type: 'fish', obj: second.world.fish[0] });

		expect(bench.selection?.worldId).toBe(second.id);
		expect(first.world.selFish).toBeNull(); // the first world let go
		expect(first.world.sense).toBeNull();
	});

	it('selects the shark without pointing a fish inspector at it', () => {
		init(1);
		const { id, world } = bench.worlds[0];

		bench.select(id, { type: 'pred', obj: world.preds[0] });

		expect(bench.selection).toEqual({ worldId: id, type: 'pred', followsChampion: false });
		expect(world.selFish).toBeNull();
	});

	it('clicking empty water clears the selection', () => {
		init(1);
		const { id, world } = bench.worlds[0];
		bench.select(id, { type: 'fish', obj: world.fish[0] });

		bench.select(id, null);

		expect(bench.selection).toBeNull();
		expect(world.selFish).toBeNull();
	});

	it('a champion selection follows the lineage across a generation turnover', () => {
		initSafeWorld();
		const { id, world } = bench.worlds[0];

		bench.selectChampion(id);
		expect(bench.selection?.followsChampion).toBe(true);
		const watched = world.selFish;

		runToNextGeneration(id);

		expect(world.eaten).toBe(0); // the turnover, NOT a shark, is what ended the watched fish
		// a NEW fish — the old one no longer exists — but the inspector is still on the best brain
		expect(bench.selection).toEqual({ worldId: id, type: 'fish', followsChampion: true });
		expect(world.selFish).not.toBe(watched);
		expect(world.fish).toContain(world.selFish); // and it is genuinely swimming
	});

	it('a hand-picked fish is let go when its generation ends, not silently swapped', () => {
		initSafeWorld();
		const { id, world } = bench.worlds[0];
		bench.select(id, { type: 'fish', obj: world.fish[0] });

		runToNextGeneration(id);

		expect(world.eaten).toBe(0); // again: the turnover is the only thing under test here
		// the fish the user chose is gone; presenting a different one as "theirs" would be a lie
		expect(bench.selection).toBeNull();
		expect(world.selFish).toBeNull();
	});

	it('ends a champion selection when the population is wiped out — nothing is alive to be best', () => {
		initSafeWorld();
		bench.togglePlay(); // pause: this test is about the store's reading of the world, not physics
		const { id, world } = bench.worlds[0];
		bench.selectChampion(id);

		// The wipe-out, exactly as the engine leaves it: no fish, and no pointer to one. (Waiting for
		// the sharks to do this for real would spin forever — the engine RESPAWNS the population at
		// every generation boundary, so "nothing alive" is never a state the sim settles into.)
		world.fish = [];
		world.selFish = null;
		frame();

		// "The best brain alive" is not a thing that exists here, so the inspector closes rather than
		// re-attaching to a fish from a generation that has already been bred and replaced.
		expect(bench.selection).toBeNull();
		expect(world.selFish).toBeNull();
	});

	it('lets go of a fish the moment a shark eats it — the inspector cannot outlive its subject', () => {
		// A cramped tank with three sharks: this fish is going to be caught, and when it is, the panel
		// showing its "live" mind has nothing left to show.
		bench.init({
			configs: [{ ...structuredClone(DEFAULT_WORLDS[0]), prey: 4, preds: 3, bw: 300, bh: 200 }]
		});
		const { id, world } = bench.worlds[0];
		const victim = world.fish[0];
		bench.select(id, { type: 'fish', obj: victim });

		let steps = 0;
		while (world.fish.includes(victim) && steps++ < 20_000) frame(1 / 60);
		expect(world.fish).not.toContain(victim); // it really got eaten
		frame();

		expect(bench.selection).toBeNull();
		expect(world.selFish).toBeNull();
	});

	it('lets go of a selection whose world is removed', () => {
		init(2);
		const [first] = bench.worlds;
		bench.select(first.id, { type: 'fish', obj: first.world.fish[0] });

		bench.removeWorld(first.id);

		expect(bench.selection).toBeNull();
	});

	it('never points at a fish that is not in the water', () => {
		init(1);
		const { id, world } = bench.worlds[0];
		bench.selectChampion(id);

		bench.resetWorld(id); // restart from random brains — every fish is replaced
		frame();

		expect(world.selFish === null || world.fish.includes(world.selFish)).toBe(true);
	});
});

describe('bench store — surviving a world being removed', () => {
	it('a hover that lands after its world is gone is ignored, not thrown', () => {
		init(2);
		const [first] = bench.worlds;
		const fish = first.world.fish[0];
		bench.removeWorld(first.id);

		// A pointer event can arrive after the tile is torn down. Hover is best-effort state about a
		// cursor; throwing out of a mousemove listener would be the wrong answer.
		expect(() => bench.setHover(first.id, fish)).not.toThrow();
		expect(() => bench.setHover(first.id, null)).not.toThrow();
	});
});

describe('bench store — duplicate', () => {
	it('gives each copy a name of its own', () => {
		init(3);
		const source = bench.worlds[2]; // "Direction"

		bench.duplicateWorld(source.id);
		bench.duplicateWorld(source.id);

		const names = bench.worlds.map((entry) => entry.world.cfg.name);
		expect(new Set(names).size).toBe(names.length); // two tiles reading the same name are ambiguous
		expect(names).toContain('Direction copy');
	});

	it('carries the evolved brains across, so a copy starts where the original is', () => {
		init(1, 2); // prewarm, so there is something worth copying
		const source = bench.worlds[0];
		frame(1 / 60, 400);

		bench.duplicateWorld(source.id);
		const copy = bench.worlds[1];

		expect(copy.world.gen).toBe(source.world.gen);
		expect(copy.world.curve).toEqual(source.world.curve);
		expect(copy.world.fish[0].genome).not.toBe(source.world.fish[0].genome); // a clone, not a share
	});
});

describe('bench store — maxGenerations', () => {
	it('publishes changes, so what is derived from it actually re-renders', () => {
		init(1);
		const seen: number[] = [];
		const stop = $effect.root(() => {
			$effect(() => void seen.push(bench.maxGenerations));
		});
		flushSync();

		bench.setMaxGenerations(40); // what Phase 7 does to start the train→deploy transition
		flushSync();
		stop();

		// A getter over a NON-reactive field reads correctly and notifies nobody: the tile would
		// never gain its "· trained" suffix and the top bar would keep offering "Train +25 gens".
		expect(seen).toEqual([0, 40]);
		expect(bench.worlds[0].world.maxGen).toBe(40); // and it reached the engine
	});
});

describe('bench store — conditions', () => {
	it('opens and closes the dialog for one world at a time', () => {
		init(2);
		const [first, second] = bench.worlds;

		bench.openConditions(first.id);
		expect(bench.conditionsWorldId).toBe(first.id);

		bench.openConditions(second.id);
		expect(bench.conditionsWorldId).toBe(second.id);

		bench.closeConditions();
		expect(bench.conditionsWorldId).toBeNull();
	});

	it('closes the dialog if the world it is editing is removed', () => {
		init(1);
		const { id } = bench.worlds[0];
		bench.openConditions(id);

		bench.removeWorld(id);

		expect(bench.conditionsWorldId).toBeNull();
	});

	it('THE POINT: an edit changes the world without wiping what it has learned', () => {
		init(1, 3); // prewarm, so there is real learning to lose
		for (let i = 0; i < 600 && bench.turboTarget !== null; i++) frame();
		const { id, world, config } = bench.worlds[0];
		const generation = world.gen;
		const curve = [...world.curve];
		const champion = world.champion;
		expect(generation).toBeGreaterThan(0);

		bench.setCondition(id, 'prey', 40);

		expect(world.cfg.prey).toBe(40);
		expect(config.prey).toBe(40); // and the tile sees it
		expect(world.gen).toBe(generation); // still the same generation…
		expect(world.curve).toEqual(curve); // …with its learning curve intact…
		expect(world.champion).toBe(champion); // …and its best brain still on record
	});

	it('seeds the fish an edit adds from the champion, rather than dropping in random brains', () => {
		init(1, 2);
		for (let i = 0; i < 600 && bench.turboTarget !== null; i++) frame();
		const { id, world } = bench.worlds[0];
		const before = world.fish.length;

		bench.setCondition(id, 'prey', world.cfg.prey + 10);

		expect(world.fish.length).toBeGreaterThan(before);
		expect(world.champion).not.toBeNull();
		const newcomer = world.fish[world.fish.length - 1];
		expect([...newcomer.genome]).toEqual([...world.champion!.genome]); // an evolved brain, not noise
	});

	it('clamps to the range the experiment allows — the engine does not validate', () => {
		init(1);
		const { id, world } = bench.worlds[0];

		bench.setCondition(id, 'prey', 500);
		expect(world.cfg.prey).toBe(WORLD_LIMITS.prey.max);

		bench.setCondition(id, 'bw', 10); // a tank 10px wide is not an experiment, it is a crash
		expect(world.cfg.bw).toBe(WORLD_LIMITS.bw.min);

		bench.setCondition(id, 'preds', -3);
		expect(world.cfg.preds).toBe(WORLD_LIMITS.preds.min);
	});

	it('re-clamps the fish into a container that just shrank', () => {
		init(1);
		const { id, world } = bench.worlds[0];
		world.fish[0].x = 1200; // out beyond the new wall

		bench.setCondition(id, 'bw', 400);

		for (const fish of world.fish) expect(fish.x).toBeLessThanOrEqual(400);
	});

	it('adds and removes predators to match the count asked for', () => {
		init(1);
		const { id, world } = bench.worlds[0];

		bench.setCondition(id, 'preds', 5);
		expect(world.preds).toHaveLength(5);

		bench.setCondition(id, 'preds', 0); // a world with no threat at all is a legal experiment
		expect(world.preds).toHaveLength(0);
	});

	it('sets a sense explicitly, not just by flipping it', () => {
		init(1);
		const { id, world, config } = bench.worlds[0];

		bench.setSense(id, 'walls', true);
		expect(world.cfg.senses.walls).toBe(true);
		expect(config.senses.walls).toBe(true);

		bench.setSense(id, 'walls', true); // idempotent: setting it again does not toggle it off
		expect(world.cfg.senses.walls).toBe(true);
	});

	it('records the accent and the story caption without touching the simulation', () => {
		init(1);
		const { id, world, config } = bench.worlds[0];
		const fish = world.fish[0];

		bench.setAccent(id, ACCENTS[5]);
		bench.setCaption(id, 'the one that learned to turn away');

		expect(config.accent).toBe(ACCENTS[5]);
		expect(config.caption).toBe('the one that learned to turn away');
		expect(world.fish[0]).toBe(fish); // nothing was respawned over a colour change
	});
});

describe('bench store — the selected fish’s mind', () => {
	it('publishes what the fish senses the moment it is selected, even paused', () => {
		init(1);
		bench.togglePlay(); // paused: no tick will come to fill this in for us
		const { id, world } = bench.worlds[0];

		bench.select(id, { type: 'fish', obj: world.fish[0] });

		// the panel opens populated — the numbers are the engine's, not zeros waiting for a frame
		expect(bench.mind.lived).toBe(world.fish[0].fitness);
		expect(bench.mind.wallAhead).toBe(world.sense!.wallFront);
	});

	it('is the ENGINE’s numbers, not the UI’s — it never computes a sense of its own', () => {
		init(1);
		bench.togglePlay();
		const { id, world } = bench.worlds[0];
		bench.select(id, { type: 'fish', obj: world.fish[0] });

		// forge the engine's snapshot: whatever is in world.sense is what the panel must show
		world.sense = { ...world.sense!, d: 123.5, dirDeg: -47, closing: -8.25, inVis: true, nd: 0.75 };
		frame();

		expect(bench.mind.distance).toBe(123.5);
		expect(bench.mind.directionDeg).toBe(-47);
		expect(bench.mind.closing).toBe(-8.25);
		expect(bench.mind.inVision).toBe(true);
		expect(bench.mind.distanceInput).toBe(0.75);
	});

	it('keeps up with the fish it is following as the world runs', () => {
		init(1);
		const { id, world } = bench.worlds[0];
		bench.selectChampion(id);
		const first = bench.mind.lived;

		frame(1 / 60, 30);

		expect(bench.mind.lived).toBeGreaterThan(first); // it has been living
		expect(bench.mind.lived).toBe(world.selFish!.fitness);
	});
});

describe('bench store — train → deploy', () => {
	/**
	 * A small, brutal world so a deployment plays out in a few thousand frames — and SEEDED, because
	 * these tests care about when a population dies, and a run that differs every time is a run whose
	 * failures cannot be reproduced.
	 */
	const initDeployable = (maxGenerations: number) =>
		bench.init({
			configs: [{ ...structuredClone(DEFAULT_WORLDS[2]), prey: 8, preds: 2, bw: 400, bh: 260 }],
			maxGenerations,
			rng: seededRng(11)
		});

	/** Run the bench until `done`, with a budget so a stall fails loudly instead of hanging. */
	const runUntil = (done: () => boolean, budget = 60_000) => {
		let steps = 0;
		while (!done() && steps++ < budget) frame(1 / 60);
		expect(steps).toBeLessThan(budget);
	};

	it('keeps evolving while the limit is 0 — the bench never deploys on its own', () => {
		initDeployable(0);
		const { world, stats } = bench.worlds[0];

		runUntil(() => world.gen >= 3);

		expect(stats.deployed).toBe(false);
		expect(world.maxGen).toBe(0);
	});

	it('deploys when a world reaches the limit, and STOPS evolving there', () => {
		initDeployable(2);
		const { world, stats } = bench.worlds[0];

		runUntil(() => stats.deployed);

		expect(world.gen).toBe(2);
		frame(1 / 60, 1200); // 20 sim-seconds: two more generations, if it were still evolving
		expect(world.gen).toBe(2); // it is not
	});

	it('THE POINT: a deployed population only ever goes DOWN — nothing respawns', () => {
		initDeployable(1);
		const { stats } = bench.worlds[0];
		runUntil(() => stats.deployed);

		let previous = stats.alive;
		for (let i = 0; i < 6000 && stats.alive > 0; i++) {
			frame(1 / 60);
			expect(stats.alive).toBeLessThanOrEqual(previous); // never once climbs back
			previous = stats.alive;
		}

		expect(stats.alive).toBe(0); // in the end, the real world takes all of them
	});

	it('LATCHES the half-life — it is a moment, not a running commentary', () => {
		initDeployable(1);
		const { world, stats } = bench.worlds[0];
		runUntil(() => stats.deployed);
		const deployed = world.deployStartN;

		runUntil(() => stats.alive <= deployed / 2);
		frame(); // the engine latches it on the step AFTER the population crosses the halfway mark
		const halfLife = stats.halfLife;
		expect(halfLife).not.toBeNull();
		expect(halfLife!).toBeGreaterThan(0);

		// Keep going. The population stays below half all the way down, so a half-life that did NOT
		// latch would keep being overwritten and end up equal to the extinction time — and every
		// assertion below would still hold. (They did. That is what this test used to be.)
		runUntil(() => stats.alive === 0);
		frame();

		expect(stats.halfLife).toBe(halfLife); // it has not moved since the moment it was reached
		expect(stats.extinctT).not.toBeNull();
		expect(stats.extinctT!).toBeGreaterThan(halfLife!); // and the end came strictly later
		expect(world.decay.length).toBeGreaterThan(0); // the red curve has something to draw
	});

	it('lowering the limit below a world deploys it on the spot', () => {
		initDeployable(0);
		const { world, stats } = bench.worlds[0];
		runUntil(() => world.gen >= 2);
		expect(stats.deployed).toBe(false);

		bench.setMaxGenerations(1); // the world is already past this

		frame();
		expect(stats.deployed).toBe(true);
	});

	it('raising the limit puts a deployed world back to evolving — a limit is not a one-way door', () => {
		initDeployable(1);
		const { stats } = bench.worlds[0];
		runUntil(() => stats.deployed);

		bench.setMaxGenerations(20);
		frame();

		expect(stats.deployed).toBe(false);
	});

	it('resetting a deployed world returns it to evolving, and takes the old run with it', () => {
		initDeployable(1);
		const { id, world, stats } = bench.worlds[0];
		runUntil(() => stats.deployed);

		// Let the run actually HAPPEN first. Resetting the instant a world deploys clears a decay
		// curve that was never drawn and a half-life that was never reached — the assertions below
		// would then hold no matter what reset did. (They did. That is what this test used to do.)
		runUntil(() => stats.halfLife !== null);
		expect(world.decay.length).toBeGreaterThan(0);

		bench.resetWorld(id);
		// Pause before projecting: the tick that refreshes the stats also STEPS the world, and a shark
		// taking a fish in that frame would leave the population at 19 through no fault of the reset.
		bench.togglePlay();
		frame();

		expect(stats.deployed).toBe(false);
		expect(stats.gen).toBe(0);
		expect(stats.alive).toBe(world.cfg.prey); // a full generation is back in the water
		// and the dead population's run goes with it — otherwise the tile would show "wiped out · 37s"
		// and a red death curve for a world that is now at generation 0, evolving
		expect(world.decay).toEqual([]);
		expect(stats.halfLife).toBeNull();
		expect(stats.extinctT).toBeNull();
	});

	it('clamps the limit to what the lab offers — and the worlds hear the clamped value', () => {
		initDeployable(10);
		const { world } = bench.worlds[0];

		bench.setMaxGenerations(9999);
		expect(bench.maxGenerations).toBe(MAX_GENERATIONS.max);
		expect(world.maxGen).toBe(MAX_GENERATIONS.max); // the engine is the one that acts on it

		bench.setMaxGenerations(-5);
		expect(bench.maxGenerations).toBe(MAX_GENERATIONS.min);
		expect(world.maxGen).toBe(MAX_GENERATIONS.min);
	});
});
