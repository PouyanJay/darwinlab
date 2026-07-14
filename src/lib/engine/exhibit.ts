/**
 * The champion exhibit: a tank filled with copies of ONE brain.
 *
 * WHY IT EXISTS. What swims in a bench tank is not a strategy — it is a strategy plus a cloud of
 * damage. Most of the weights mutate every generation, so the twenty fish on screen are mostly
 * degraded copies of the best one, and the behaviour you watch is the AVERAGE of a smear. That is
 * why a world that has genuinely learned to flee still looks, to the eye, like a world that has not:
 * the champion's rule is in there, drowned in its own mutants. Fill the tank with the champion
 * instead and the rule is simply visible.
 *
 * WHAT IT IS NOT. It is not evolution. Nothing in an exhibit breeds, is selected, is scored, or
 * writes to a learning curve. It is a copy of a genome put in water so you can look at it, and the
 * run it was copied from is not touched by the looking.
 *
 * The bottleneck below is the exception, and it is deliberately the loud one — see its own note.
 */

import { cloneGenome } from './genetics';
import { makeWorld, makeFish, applyCfg } from './world';
import { defaultRng, type Rng } from './rng';
import type { Genome, World } from './types';

/**
 * The brain to put on show: THE BEST OF THE LAST GENERATION — what this population currently knows.
 *
 * Deliberately not `w.champion`, and this is the single most important line in the file. `champion`
 * is the best fitness ever recorded, but fitness is seconds survived and the generation caps it: the
 * first fish to run the clock out scores the maximum and can never be beaten, only tied, so the
 * champion freezes forever on an early lucky fish. Cloning THAT was measurably worse than the
 * population it was drawn from — the exhibit was showing a fossil and calling it the best brain in
 * the tank. `best` is re-crowned every generation and is what the population actually has.
 *
 * Falls back to the elite, and then to the best fish alive that has earned anything at all. A world
 * at generation 0 honestly has nothing to exhibit, and says so with a null — the caller must be able
 * to refuse rather than put a random brain on a pedestal.
 */
export function championGenome(w: World): Genome | null {
	if (w.best) return cloneGenome(w.best.genome);
	if (w.champion) return cloneGenome(w.champion.genome);

	// The fallback is for MID-generation, before the first champion has been crowned: the best fish
	// alive is a defensible "best brain so far". But it must have actually EARNED something — at
	// generation zero every fitness is 0, and picking the first fish out of a random population and
	// presenting it as the champion would be the exhibit lying on the lab's behalf.
	let best: Genome | null = null;
	let bestFitness = 0;
	for (const f of w.fish) {
		if (f.fitness > bestFitness) {
			bestFitness = f.fitness;
			best = f.genome;
		}
	}
	return best ? cloneGenome(best) : null;
}

/**
 * A separate tank, filled with clones of `genome`, that will never evolve.
 *
 * `maxGen`/`gen` are set to the deployed pair, which is the engine's own way of saying "this
 * population is final": no generation boundary, no breeding, no respawn. So the exhibit cannot
 * quietly become a second, accidental experiment running alongside the real one — it has no way to
 * select anything, because nothing in it is ever ranked.
 *
 * It carries its own RNG. Drawing from the real world's would consume the very draws the real run is
 * going to make, and the run would come out different because somebody looked at it.
 */
export function makeExhibit(w: World, genome: Genome, rng: Rng = defaultRng): World {
	const clones = Array.from({ length: w.cfg.prey }, () => cloneGenome(genome));
	const exhibit = makeWorld(w.cfg, clones, rng);
	exhibit.maxGen = 1;
	exhibit.gen = 1;

	/*
	 * NORMALISE THE POPULATION, or the tank shows a world nobody configured.
	 *
	 * `makeWorld` carries a fidelity quirk it documents in place: the reference engine spawns
	 * `cfg.preds` predators and then spawns them AGAIN, so a fresh world opens generation 0 with
	 * DOUBLE the sharks. In an evolving world the first generation boundary quietly puts it right and
	 * nobody is any the wiser. An exhibit never has a generation boundary — it is frozen by
	 * construction — so the doubles are permanent: a world configured for three sharks was showing
	 * six, and the Conditions slider could not take them away, because the config was never wrong.
	 *
	 * `applyCfg` is the engine's own "make this world match its config", and it trims them.
	 */
	applyCfg(exhibit);
	return exhibit;
}

/** Has this exhibit run itself out? (Everything eaten — nothing will respawn, by design.) */
export function exhibitSpent(exhibit: World): boolean {
	return exhibit.fish.length === 0;
}

/**
 * THE CLONAL BOTTLENECK — the one mode here that is an intervention rather than a view.
 *
 * It replaces the living population with copies of the champion and lets evolution carry on from
 * there. That is a real event with real consequences: variation collapses to zero, every subsequent
 * generation is descended from one individual, and the run's curve records what happened next. It is
 * genuinely interesting — it is a founder effect, and you can watch diversity rebuild from mutation
 * alone — but it is NOT undoable, and the run afterwards is a different run.
 *
 * So it returns the generation it struck at, and the caller is expected to mark it: an intervention
 * that is not recorded is a lie by omission, and a learning curve with an unmarked cliff in it is
 * exactly the kind of chart this product exists to argue against.
 */
export function bottleneck(w: World): number | null {
	const genome = championGenome(w);
	if (!genome) return null;

	// The generation is respawned FROM THE CHAMPION — same gen, same curve, same history. What
	// changes is who is in the water, which is the whole point of the intervention.
	w.fish = [];
	w.roster = [];
	w.eaten = 0;
	w.genT = 0;
	w.bursts = [];
	w.selFish = null;
	w.sense = null;
	w.hover = null;
	w.championFish = null;

	for (let i = 0; i < w.cfg.prey; i++) {
		const f = makeFish(w.cfg, cloneGenome(genome), w.rng);
		w.fish.push(f);
		w.roster.push(f);
	}
	return w.gen;
}
