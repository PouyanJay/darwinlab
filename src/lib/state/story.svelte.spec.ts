import { describe, it, expect, afterEach } from 'vitest';
import { bench } from './bench.svelte';
import { story, SCENE_SECONDS, STORY_WORLD_ID } from './story.svelte';
import { DEFAULT_WORLDS, seededRng } from '../engine';

afterEach(() => {
	story.exit();
	bench.destroy();
});

const openBench = (worlds = 5) =>
	bench.init({ configs: DEFAULT_WORLDS.slice(0, worlds), rng: seededRng(5) });

/** Drive frames deterministically instead of racing the real 16ms timer. */
const frame = (elapsed = 1 / 60, count = 1) => {
	for (let i = 0; i < count; i++) bench.tick(elapsed);
};

/** Play a whole scene's worth of sim-seconds. */
const playScene = () => frame(1 / 60, Math.ceil(SCENE_SECONDS * 60) + 2);

describe('story — the scenes', () => {
	it('is one scene per world, in the order the argument is made', () => {
		openBench();

		bench.playStory();

		expect(story.active).toBe(true);
		expect(story.total).toBe(5);
		expect(story.index).toBe(0);
		expect(story.source?.config.name).toBe('Blind drift'); // the argument starts at nothing
	});

	it('cuts a FRESH full generation of the world’s evolved brains, not the survivors', () => {
		openBench(1);
		const source = bench.worlds[0];
		frame(1 / 60, 400); // let the sharks thin the population out
		expect(source.stats.alive).toBeLessThan(source.world.cfg.prey);

		bench.playStory();

		// a scene opens with a full tank of competent fish — the same evolved population, just not
		// caught mid-slaughter
		expect(story.entry!.world.fish.length).toBe(source.world.cfg.prey);
		expect(story.entry!.world.gen).toBe(source.world.gen); // and it says which generation it is
		expect(story.entry!.world).not.toBe(source.world); // a copy: the bench is left untouched
	});

	it('tags the sense each scene ADDS — that tag is the whole reason for the order', () => {
		openBench();
		bench.playStory();

		const tagged = () => story.senses.filter((sense) => sense.isNew).map((sense) => sense.name);

		expect(tagged()).toEqual([]); // Blind drift adds nothing; it IS the nothing
		story.next();
		expect(tagged()).toEqual(['Distance']);
		story.next();
		expect(tagged()).toEqual(['Direction']); // the one that pays
		story.next();
		// walls comes BEFORE closing speed now — the order the measurements put them in (walls pays
		// on top of direction; closing only stacks once everything else is in place)
		expect(tagged()).toEqual(['Walls']);
		story.next();
		expect(tagged()).toEqual(['Closing speed']);
	});

	it('says which senses a scene’s brains actually have, not just the new one', () => {
		openBench();
		bench.playStory();
		story.goTo(2); // "Direction": distance AND direction

		const on = story.senses.filter((sense) => sense.on).map((sense) => sense.name);

		expect(on).toEqual(['Distance', 'Direction']);
	});
});

describe('story — the film runs itself', () => {
	it('advances to the next scene when a scene has run its length', () => {
		openBench();
		bench.playStory();
		const first = story.entry;

		playScene();

		expect(story.index).toBe(1);
		expect(story.entry).not.toBe(first); // a new scene, a new world
		expect(story.elapsed).toBeLessThan(SCENE_SECONDS); // and a fresh clock
	});

	it('a jump to the scene already on screen is NOT a jump — the held film keeps its world', () => {
		openBench(2);
		bench.playStory();
		const first = story.entry!.world;

		story.goTo(story.index); // clicking the segment already filling
		story.previous(); // one back from the first scene — clamped onto itself
		expect(story.entry!.world).toBe(first); // no silent re-cut

		story.goTo(1);
		const second = story.entry!.world;
		expect(second).not.toBe(first); // a real jump still cuts fresh

		story.next(); // one past the last scene — clamped onto itself
		expect(story.entry!.world).toBe(second);
	});

	it('ENDS PAUSED on the last scene rather than looping or going black', () => {
		openBench(2);
		bench.playStory();

		playScene(); // → scene 2 (the last)
		expect(story.index).toBe(1);
		playScene(); // → the end

		expect(story.index).toBe(1); // it stays on the last scene…
		expect(bench.running).toBe(false); // …and stops there, holding the final image
		expect(story.active).toBe(true);
	});

	it('holds the bench still while the film plays — the scene is the only thing moving', () => {
		openBench(2);
		const benchWorld = bench.worlds[0].world;
		bench.playStory();
		const before = benchWorld.t;

		frame(1 / 60, 120);

		expect(benchWorld.t).toBe(before); // no sim time passed on the bench…
		expect(story.entry!.world.t).toBeGreaterThan(0); // …and plenty passed in the scene
	});

	it('runs the scene clock on SIM time, so speed changes the film', () => {
		openBench();
		bench.playStory();

		bench.setSpeed(2);
		frame(1 / 60, 60); // one real second

		// Tight on purpose: 60 fixed ticks of 1/60 × 2 is deterministic to a rounding error, so any
		// slack here is slack a mis-applied multiplier could hide inside.
		expect(story.elapsed).toBeCloseTo(2, 5);
	});

	it('does not advance the scene while paused', () => {
		openBench();
		bench.playStory();
		bench.togglePlay();

		frame(1 / 60, 300);

		expect(story.elapsed).toBe(0);
	});
});

describe('story — it will not roll over a moving bench', () => {
	it('refuses to start while the bench is TRAINING, rather than stranding the turbo', () => {
		// A story does not advance the bench, so a turbo burst caught mid-flight would simply hang:
		// the pill spinning behind the film, the worlds frozen part way to their target.
		bench.init({ configs: DEFAULT_WORLDS.slice(0, 2), prewarmGenerations: 5, rng: seededRng(3) });
		expect(bench.turboTarget).not.toBeNull();

		const started = bench.playStory();

		expect(started).toBe(false);
		expect(story.active).toBe(false);
	});

	it('rolls once the training has landed', () => {
		bench.init({ configs: DEFAULT_WORLDS.slice(0, 2), prewarmGenerations: 2, rng: seededRng(3) });
		for (let i = 0; i < 2000 && bench.turboTarget !== null; i++) frame();
		expect(bench.turboTarget).toBeNull();

		expect(bench.playStory()).toBe(true);
		expect(story.active).toBe(true);
	});

	it('has nothing to tell a story about when the bench is empty', () => {
		bench.init({ configs: [] });

		expect(bench.playStory()).toBe(false);
		expect(story.active).toBe(false);
	});
});

describe('story — the transport', () => {
	it('jumps, and clamps to the film it actually has', () => {
		openBench(3);
		bench.playStory();

		story.goTo(2);
		expect(story.index).toBe(2);

		story.next(); // there is no scene 4
		expect(story.index).toBe(2);

		story.goTo(-5);
		expect(story.index).toBe(0);
	});

	it('re-cuts the scene when you jump back to it — the film does not resume mid-carnage', () => {
		openBench(2);
		bench.playStory();
		frame(1 / 60, 600); // ten seconds of hunting
		const scarred = story.entry!.world.fish.length;
		expect(scarred).toBeLessThanOrEqual(story.source!.config.prey);

		story.next();
		story.previous();

		expect(story.entry!.world.fish.length).toBe(story.source!.config.prey);
		expect(story.elapsed).toBe(0);
	});

	it('leaving the film puts the bench back exactly where it was', () => {
		openBench(2);
		const benchWorld = bench.worlds[0].world;
		bench.playStory();
		frame(1 / 60, 120);
		const benchTime = benchWorld.t;

		bench.exitStory();

		expect(story.active).toBe(false);
		expect(story.entry).toBeNull();
		expect(benchWorld.t).toBe(benchTime); // untouched by the film
		expect(bench.running).toBe(true);
	});
});

describe('story — the inspector works inside the film', () => {
	it('finds the story world, which is not on the bench but is on screen', () => {
		openBench(1);
		bench.playStory();

		expect(bench.find(STORY_WORLD_ID)).toBe(story.entry);
	});

	it('can select a fish mid-scene and read its mind', () => {
		openBench(1);
		bench.playStory();
		bench.togglePlay(); // paused, so the fish cannot be eaten out from under the assertion
		const fish = story.entry!.world.fish[0];

		bench.select(STORY_WORLD_ID, { type: 'fish', obj: fish });

		expect(bench.selection?.worldId).toBe(STORY_WORLD_ID);
		expect(story.entry!.world.selFish).toBe(fish);
		expect(bench.mind.lived).toBe(fish.fitness); // the panel is live over a scene, like anywhere
	});

	it('lets a selection go when the film moves on — that fish was in the last scene', () => {
		openBench(2);
		bench.playStory();
		bench.select(STORY_WORLD_ID, { type: 'fish', obj: story.entry!.world.fish[0] });

		story.next();
		frame();

		expect(bench.selection).toBeNull();
	});
});
