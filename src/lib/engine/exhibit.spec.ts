import { describe, it, expect } from 'vitest';
import { makeWorld, stepWorld, seededRng, DEFAULT_WORLDS } from './index';
import { championGenome, makeExhibit, exhibitSpent, bottleneck } from './exhibit';
import type { World } from './types';

/**
 * The exhibit's promise is a NEGATIVE one — "this does not touch the run" — and a negative promise is
 * the easiest kind to break by accident and the hardest to notice when you do. So most of what is
 * pinned here is what must NOT have happened.
 */

const cfg = DEFAULT_WORLDS[2]; // Direction

function evolved(gens: number, seed = 5): World {
	const w = makeWorld(cfg, undefined, seededRng(seed));
	let steps = 0;
	while (w.gen < gens && steps < gens * 5000) {
		stepWorld(w, 1 / 60);
		steps++;
	}
	return w;
}

/** Everything the simulation IS — who is where, what they know, what they are worth. */
const stateOf = (w: World) =>
	JSON.stringify({
		t: w.t,
		gen: w.gen,
		eaten: w.eaten,
		curve: w.curve,
		lifeCurve: w.lifeCurve,
		champion: w.champion && [Array.from(w.champion.genome), w.champion.fitness, w.champion.gen],
		fish: w.fish.map((f) => [f.x, f.y, f.vx, f.vy, f.fitness, Array.from(f.genome)])
	});

describe('championGenome', () => {
	it('is null at generation zero — nothing has been judged, so nothing is the best', () => {
		const fresh = makeWorld(cfg, undefined, seededRng(1));
		// Every fitness is 0 and no generation has ended. There is no champion here, and handing back
		// the first fish of a random population as "the champion" would be the exhibit lying for us.
		expect(fresh.champion).toBeNull();
		expect(championGenome(fresh)).toBeNull();
	});

	it('hands back a COPY of the champion, not the champion itself', () => {
		const w = evolved(3);
		const genome = championGenome(w)!;
		genome[0] = 999; // vandalise the copy
		expect(w.champion!.genome[0]).not.toBe(999); // the run's own champion is untouched
	});
});

describe('makeExhibit', () => {
	it('fills the tank with ONE brain, repeated', () => {
		const w = evolved(3);
		const exhibit = makeExhibit(w, championGenome(w)!, seededRng(2));

		expect(exhibit.fish).toHaveLength(cfg.prey);
		const first = Array.from(exhibit.fish[0].genome);
		for (const f of exhibit.fish) expect(Array.from(f.genome)).toEqual(first);
	});

	it("shows the world the CONFIG describes — not makeWorld's double predators", () => {
		/*
		 * The bug the owner found. makeWorld spawns cfg.preds predators and then spawns them again (a
		 * reference quirk it documents), and an evolving world's first generation boundary quietly puts
		 * it right. An exhibit is frozen by construction and never reaches one — so a world configured
		 * for three sharks showed SIX, permanently, and the Conditions slider could not take them away
		 * because the config had never been wrong.
		 */
		const w = evolved(3);
		const exhibit = makeExhibit(w, championGenome(w)!, seededRng(2));

		expect(exhibit.preds).toHaveLength(cfg.preds);
		expect(exhibit.preds.length).toBe(w.preds.length); // the same water, the same hunters
	});

	it('cannot evolve: it never breeds, never scores, never respawns', () => {
		const w = evolved(3);
		const exhibit = makeExhibit(w, championGenome(w)!, seededRng(2));

		// Well past TWO generation boundaries — these worlds run 30 sim-second generations, so a
		// shorter run would have proved nothing: no generation would have been due either way.
		for (let i = 0; i < 70 * 60; i++) stepWorld(exhibit, 1 / 60);

		expect(exhibit.gen).toBe(1); // no generation ever turned
		expect(exhibit.curve).toEqual([]); // nothing was recorded
		expect(exhibit.lifeCurve).toEqual([]);
		expect(exhibit.champion).toBeNull(); // and nothing was ever crowned
	});

	it('is SEALED: stepping it does not move the run it was cloned from', () => {
		// The whole promise of the frozen mode, at the engine level.
		const w = evolved(3);
		const before = stateOf(w);

		const exhibit = makeExhibit(w, championGenome(w)!, seededRng(2));
		for (let i = 0; i < 40 * 60; i++) stepWorld(exhibit, 1 / 60);

		expect(stateOf(w)).toBe(before); // not a fish, not a weight, not a curve point
	});

	it("does not steal the run's FUTURE either — it shares no dice with it", () => {
		/*
		 * The sabotage that got through the first version of this file: `stateOf` compares the world's
		 * visible state, and consuming one of its RNG draws does not change that state — it changes
		 * every state after it. An exhibit built on the real world's random stream would leave the run
		 * looking untouched and then evolving differently, which is the worst kind of contamination:
		 * invisible at the moment it happens, and impossible to attribute later.
		 *
		 * So: two identical runs. One of them has an exhibit built and stepped against it. Then BOTH
		 * are stepped, hard, and must still agree.
		 */
		const watched = evolved(3);
		const control = evolved(3);
		expect(stateOf(watched)).toBe(stateOf(control));

		const exhibit = makeExhibit(watched, championGenome(watched)!, seededRng(2));
		for (let i = 0; i < 20 * 60; i++) stepWorld(exhibit, 1 / 60);

		for (let i = 0; i < 40 * 60; i++) {
			stepWorld(watched, 1 / 60);
			stepWorld(control, 1 / 60);
		}

		expect(stateOf(watched)).toBe(stateOf(control)); // looking at it cost the run nothing
	});

	it('runs itself out rather than respawning — and says so', () => {
		const w = evolved(3);
		const exhibit = makeExhibit(w, championGenome(w)!, seededRng(2));
		expect(exhibitSpent(exhibit)).toBe(false);

		exhibit.fish = []; // the sharks got the last one
		expect(exhibitSpent(exhibit)).toBe(true); // …and nothing will bring it back: the store re-clones
	});
});

describe('bottleneck', () => {
	it('replaces the population with the champion — and KEEPS the run', () => {
		const w = evolved(4);
		const champion = Array.from(championGenome(w)!);
		const gen = w.gen;
		const curve = [...w.lifeCurve];

		const at = bottleneck(w);

		expect(at).toBe(gen); // it reports where it struck, so the curve can be marked
		expect(w.gen).toBe(gen); // the run did not restart…
		expect(w.lifeCurve).toEqual(curve); // …and it did not lose its history
		expect(w.fish).toHaveLength(cfg.prey);
		for (const f of w.fish) expect(Array.from(f.genome)).toEqual(champion); // all one lineage now
	});

	it('leaves evolution able to carry on from the clones', () => {
		const w = evolved(4);
		bottleneck(w);
		const gen = w.gen;

		// A generation here is 30 sim-seconds (DEFAULT_WORLDS), not the engine's bare 10.
		for (let i = 0; i < 35 * 60; i++) stepWorld(w, 1 / 60);

		expect(w.gen).toBeGreaterThan(gen); // generations still turn — this is not a frozen tank
		expect(w.lifeCurve.length).toBeGreaterThan(0);
	});

	it('refuses on a world with no champion, rather than enshrining a random fish', () => {
		const fresh = makeWorld(cfg, undefined, seededRng(1));
		// Nothing has earned anything yet. A bottleneck here would make a random brain the ancestor of
		// every fish that ever swims in this world — on no evidence whatsoever.
		expect(bottleneck(fresh)).toBeNull();
		expect(fresh.fish).toHaveLength(cfg.prey); // and the population is left exactly as it was
	});
});
