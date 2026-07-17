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
 * init on a FIXED SEED, then STOP the real loop — this spec drives time itself, via run().
 *
 * Two separate flakes have failed CI from here, both because the sim was unseeded:
 *
 *   • bench.init starts the live timer chain, so without the stop() the sim has TWO drivers: the
 *     manual run() and the background loop, which under CI starvation fires late and catches up in
 *     big gulps of elapsed time. playback.stop() kills the timer but leaves `running` true, so the
 *     manual tick still steps; only the racing driver is gone.
 *   • even with ONE driver the outcome was still random: these worlds have three sharks and gen-0
 *     brains flee blind, so an unlucky draw could wipe the whole population inside a test's window
 *     — ending a generation early on the `fish.length === 0` path (a "not finished yet" world
 *     arriving at gen 1), or leaving benchWithChampion's run with no champion to exhibit. The engine
 *     takes every random draw from `w.rng`, so a seed makes the run identical on every machine and
 *     every attempt. That is what turns these from "usually green" into deterministic.
 */
const SEED = 20260716;
function initSolo(init: Parameters<typeof bench.init>[0]) {
	bench.init({ ...init, seed: init.seed ?? SEED });
	bench.playback.stop();
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
	initSolo({ configs: [DEFAULT_WORLDS[2]], prewarmGenerations: 0, maxGenerations: 0 });
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

	it('an exhibit KEEPS SWIMMING through a training burst', () => {
		/*
		 * Turbo fast-forwards the real runs and does not animate them — that is the bargain, and the
		 * pill says so. But an exhibit is not one of the runs being trained; it is a tank the user is
		 * watching. Left unstepped, it froze into a still image for as long as the burst lasted (gen 1
		 * to 150 is a long minute), and the app looked hung — but ONLY when the clones were on, which
		 * is exactly what the owner saw and reported.
		 */
		const entry = benchWithChampion();
		bench.setExhibit(entry.id, 'live');

		// A burst long enough to still be running when we look — the owner's was gen 1 to 150.
		bench.trainTo(entry.world.gen + 60);
		const exhibit = bench.shown(entry.id);
		expect(exhibit).not.toBe(entry.world);

		// Its own clock, on its own object: a REBUILT exhibit is a new world with a fresh (random)
		// start time, so comparing `shown().t` across a rebuild compares two different clocks and
		// proves nothing. This holds the tank and watches it move.
		const clock = exhibit.t;
		run(0.3);

		expect(bench.turboTarget).not.toBeNull(); // the burst really is still under way…
		expect(exhibit.t).toBeGreaterThan(clock); // …and the clones are swimming through it
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

	it('refuses to exhibit a world that has no champion yet', () => {
		initSolo({ configs: [DEFAULT_WORLDS[0]], prewarmGenerations: 0, maxGenerations: 0 });
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
		 *
		 * preds: 0 is load-bearing, not a tidy-up. A generation also ends when the population is WIPED
		 * OUT (world.ts: `genT >= genDuration || fish.length === 0`), and gen-0 brains flee blind. On
		 * an unlucky unseeded draw the three sharks ate all 20 fish inside these 5 seconds, the
		 * generation turned on the depopulation path, and the world arrived at gen 1 — the flake that
		 * failed CI and blocked a deploy. With no predator nobody dies, so the ONLY thing that can end
		 * this generation is the 30-second clock, which run(5) comes nowhere near. `eaten === 0` proves
		 * that is the path under test.
		 */
		initSolo({
			configs: [{ ...DEFAULT_WORLDS[2], preds: 0 }],
			prewarmGenerations: 0,
			maxGenerations: 0
		});
		const entry = bench.worlds[0];

		run(5);
		expect(entry.world.gen).toBe(0); // no generation has ended…
		expect(entry.world.eaten).toBe(0); // …because nobody could die, so only the clock could turn it
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
		initSolo({ configs: [DEFAULT_WORLDS[2]], prewarmGenerations: 0, maxGenerations: 0 });

		const fresh = bench.worlds[0];
		expect(fresh.id).toBe(staleId); // the same id — which is exactly why this can go wrong
		expect(bench.exhibitMode(fresh.id)).toBe('off');
		expect(bench.shown(fresh.id)).toBe(fresh.world); // its own water, not the dead run's clones
	});

	it('recovers the moment the world crowns its first brain', () => {
		initSolo({ configs: [DEFAULT_WORLDS[2]], prewarmGenerations: 0, maxGenerations: 0 });
		const entry = bench.worlds[0];

		expect(bench.setExhibit(entry.id, 'live')).toBe(false); // nothing judged yet
		run(35); // one generation (30 sim-seconds)

		expect(entry.world.best).not.toBeNull();
		expect(bench.setExhibit(entry.id, 'live')).toBe(true); // …and now it works
	});
});
