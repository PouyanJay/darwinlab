/**
 * A bout's world, FROZEN: no respawns, no breeding — the population IS the subject, not something
 * still evolving. This is the one setup `measureBout` (the behaviour numbers) and `traceBout` (the
 * paths) share, extracted so the recipe can never drift between them.
 *
 * `makeWorld` spawns the configured predators TWICE (the reference does it; an evolving world's first
 * generation boundary puts it right). A frozen bout never reaches that boundary, so `applyCfg`
 * normalises it by hand — otherwise every measurement is taken against double the sharks the
 * environment says it has.
 */

import { makeWorld, applyCfg, seededRng } from '../engine';
import type { Genome, WorldConfig, World } from '../engine';

export function makeFrozenWorld(
	cfg: WorldConfig,
	genomes: Genome[] | undefined,
	seed: number
): World {
	const w = makeWorld(cfg, genomes, seededRng(seed));
	w.maxGen = 1;
	w.gen = 1;
	applyCfg(w);
	return w;
}
