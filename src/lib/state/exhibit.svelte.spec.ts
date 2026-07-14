import { describe, it, expect, afterEach } from 'vitest';
import { bench } from './bench.svelte';
import { DEFAULT_WORLDS } from '../engine';

/**
 * The exhibit, as the STORE runs it — which is where its promises actually live.
 *
 * engine/exhibit.spec.ts proves a sealed tank cannot evolve and cannot touch the run it was cloned
 * from. None of that is worth anything if the store then steps the real world anyway while claiming
 * to have frozen it, and a sabotage of exactly that line passed every other test in this repo. So
 * the freeze is pinned here, against the real tick.
 */

/** Drive the bench the way the loop does, without racing a 16ms timer. */
function run(seconds: number) {
	const dt = 1 / 60;
	for (let i = 0; i < seconds * 60; i++) bench.tick(dt, dt);
}

/**
 * A bench with one world, evolved far enough to HAVE a champion to exhibit.
 *
 * Evolved by DRIVING THE TICK, not by asking for a prewarm: a prewarm is a turbo burst that runs
 * across frames, so a test that asked for one and looked immediately would find generation zero and
 * no champion — and would then be testing the empty case while claiming to test the full one.
 * A generation in these worlds is 30 sim-seconds.
 */
function benchWithChampion() {
	bench.init({ configs: [DEFAULT_WORLDS[2]], prewarmGenerations: 0, maxGenerations: 0 });
	run(35);
	const entry = bench.worlds[0];
	expect(entry.world.champion).not.toBeNull(); // …or there is nothing under test
	return entry;
}

afterEach(() => bench.destroy());

describe('the champion exhibit, in the store', () => {
	it('FROZEN holds the real run still — and switching it off resumes it', () => {
		const entry = benchWithChampion();
		const before = { t: entry.world.t, gen: entry.world.gen, eaten: entry.world.eaten };

		expect(bench.setExhibit(entry.id, 'frozen')).toBe(true);
		run(20);

		// The clones have been swimming for twenty seconds. The run has not moved at all.
		expect(entry.world.t).toBe(before.t);
		expect(entry.world.gen).toBe(before.gen);
		expect(entry.world.eaten).toBe(before.eaten);
		expect(bench.shown(entry.id)).not.toBe(entry.world); // …and it really was showing the exhibit

		bench.setExhibit(entry.id, 'off');
		expect(bench.shown(entry.id)).toBe(entry.world);

		run(2);
		expect(entry.world.t).toBeGreaterThan(before.t); // picked up exactly where it stood
	});

	it('LIVE keeps the real run evolving underneath the clones', () => {
		const entry = benchWithChampion();
		const t0 = entry.world.t;

		expect(bench.setExhibit(entry.id, 'live')).toBe(true);
		run(20);

		expect(entry.world.t).toBeGreaterThan(t0); // the experiment carried on…
		expect(bench.shown(entry.id)).not.toBe(entry.world); // …while you watched the champion
	});

	it('a training burst KEEPS the exhibit, and re-clones it from the brain that came out', () => {
		/*
		 * The owner's second bug: switching the clones on and pressing Train made the clones vanish.
		 * Pressing Train is not a request to stop looking at clones. The mode survives the burst, and
		 * the exhibit is rebuilt from the new champion when it ends.
		 */
		const entry = benchWithChampion();
		bench.setExhibit(entry.id, 'frozen');
		const before = bench.shown(entry.id);

		bench.trainTo(entry.world.gen + 2);
		while (bench.turboTarget !== null) run(1 / 60); // drive the burst to completion

		expect(bench.exhibitMode(entry.id)).toBe('frozen'); // still looking at clones…
		const after = bench.shown(entry.id);
		expect(after).not.toBe(entry.world); // …still an exhibit, not the population…
		expect(after).not.toBe(before); // …and re-cloned from the champion that just evolved
	});

	it('a bottleneck is RECORDED on the run it changed', () => {
		const entry = benchWithChampion();
		const gen = entry.world.gen;

		expect(bench.bottleneckWorld(entry.id)).toBe(true);

		// The population is now one lineage…
		const genomes = entry.world.fish.map((f) => Array.from(f.genome));
		for (const g of genomes) expect(g).toEqual(genomes[0]);
		// …and the run says so, for as long as it lives. An intervention that is not on the record is
		// a lie by omission, and the curve would otherwise show an unexplained cliff.
		expect(bench.interventionsOf(entry.id)).toEqual([gen]);
	});

	it('refuses to exhibit a world that has no champion yet', () => {
		bench.init({ configs: [DEFAULT_WORLDS[0]], prewarmGenerations: 0, maxGenerations: 0 });
		const entry = bench.worlds[0];
		expect(entry.world.champion).toBeNull(); // generation zero: nothing has been judged

		expect(bench.setExhibit(entry.id, 'frozen')).toBe(false);
		expect(bench.shown(entry.id)).toBe(entry.world); // and the tank still shows the real thing
	});

	it('THE DEADLOCK: a world that has been running but has not FINISHED a generation still refuses', () => {
		/*
		 * The owner's bug, and it was a trap of my own making. Fitness is SECONDS SURVIVED, so one
		 * second after a reset every fish has some — and a "best fish alive with any fitness" fallback
		 * therefore crowns an arbitrary, unevolved brain. The exhibit would open on it, and a FROZEN
		 * exhibit holds the run: the world could then never reach the generation boundary that would
		 * have crowned it a real champion. Generation 0, forever, with no way out but a reset.
		 *
		 * So: run a fresh world for several seconds — long enough for every fish to have real fitness,
		 * nowhere near long enough to finish a generation (they are 30 sim-seconds) — and demand the
		 * exhibit still refuses.
		 */
		bench.init({ configs: [DEFAULT_WORLDS[2]], prewarmGenerations: 0, maxGenerations: 0 });
		const entry = bench.worlds[0];

		run(5);
		expect(entry.world.gen).toBe(0); // no generation has ended…
		expect(Math.max(...entry.world.fish.map((f) => f.fitness))).toBeGreaterThan(0); // …but they have all lived

		expect(bench.setExhibit(entry.id, 'frozen')).toBe(false);
		expect(bench.shown(entry.id)).toBe(entry.world);

		// …and the run is still running, which is the whole point: it can still reach a champion.
		const t = entry.world.t;
		run(2);
		expect(entry.world.t).toBeGreaterThan(t);
	});

	it('does not leak an exhibit into the NEXT bench', () => {
		/*
		 * Ids are handed out from a counter that `destroy()` resets, so the `w1` of the next bench has
		 * the same id as the `w1` of this one — and an exhibit left behind in a Map keyed by id would
		 * attach itself to a completely different world. The tank would show clones of a brain from a
		 * run that no longer exists, and nothing on screen would say so.
		 */
		const first = benchWithChampion();
		expect(bench.setExhibit(first.id, 'frozen')).toBe(true);
		const staleId = first.id;

		bench.destroy();
		bench.init({ configs: [DEFAULT_WORLDS[2]], prewarmGenerations: 0, maxGenerations: 0 });

		const fresh = bench.worlds[0];
		expect(fresh.id).toBe(staleId); // the same id — which is exactly why this can go wrong
		expect(bench.exhibitMode(fresh.id)).toBe('off');
		expect(bench.shown(fresh.id)).toBe(fresh.world); // its own water, not the dead run's clones
	});

	it('recovers the moment the world crowns its first brain', () => {
		bench.init({ configs: [DEFAULT_WORLDS[2]], prewarmGenerations: 0, maxGenerations: 0 });
		const entry = bench.worlds[0];

		expect(bench.setExhibit(entry.id, 'live')).toBe(false); // nothing judged yet
		run(35); // one generation (30 sim-seconds)

		expect(entry.world.best).not.toBeNull();
		expect(bench.setExhibit(entry.id, 'live')).toBe(true); // …and now it works
	});
});
