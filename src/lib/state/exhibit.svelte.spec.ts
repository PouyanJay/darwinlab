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
});
