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
 */

import { cloneGenome } from './genetics';
import { makeWorld, applyCfg } from './world';
import { defaultRng, type Rng } from './rng';
import type { Genome, World } from './types';

/**
 * The brain to put on show: THE BEST OF THE LAST COMPLETED GENERATION.
 *
 * `best` is re-crowned at every generation boundary and is what the population currently knows.
 * `champion` — the GA's all-time elite — is the fallback, and it is a fallback rather than the answer
 * because it SATURATES: fitness is seconds survived, the generation caps it, and the elite is only
 * re-crowned on a strictly greater score, so the first fish to run the clock out holds the title
 * forever. Cloning that fossil measured worse than cloning the current population.
 *
 * BOTH ARE ONLY EVER SET AT A GENERATION BOUNDARY, and that is the whole point of this function's
 * shape. A world at generation 0 has judged nobody, so it returns null and the caller must be able to
 * refuse.
 *
 * There used to be a third fallback here — "the best fish alive with any fitness at all" — and it was
 * a trap. Fitness is seconds survived, so one second after a reset every fish has some, and the
 * "best" of an unevolved population is an arbitrary random brain. The exhibit would then open on it,
 * and a FROZEN exhibit holds the run — so the world could never reach the generation that would have
 * crowned it a real champion. Generation 0, forever. Nothing is exhibited until something is judged.
 */
export function championGenome(w: World): Genome | null {
	if (w.best) return cloneGenome(w.best.genome);
	if (w.champion) return cloneGenome(w.champion.genome);
	return null;
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
