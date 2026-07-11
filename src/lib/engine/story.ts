/**
 * Story mode helper. Faithful port of engine2.js `makeStoryWorld`.
 *
 * Clones an evolved world into a FRESH full generation for a story scene: the new fish are
 * seeded from the source's champion + ranked genomes (so the scene shows evolved behavior
 * from tick one), while gen / curve / champion are copied over for the scene's stats.
 */

import { makeWorld } from './world';
import { makeGenome } from './network';
import { cloneGenome } from './genetics';
import { type Rng, defaultRng } from './rng';
import type { World, Genome } from './types';

export function makeStoryWorld(src: World, rng: Rng = defaultRng): World {
	const cfg = JSON.parse(JSON.stringify(src.cfg)) as World['cfg'];
	const ranked = src.roster.slice().sort((a, b) => b.fitness - a.fitness);
	const pool: Genome[] = [];
	if (src.champion) pool.push(src.champion.genome);
	for (const f of ranked) pool.push(f.genome);
	const genomes: Genome[] = [];
	for (let i = 0; i < cfg.prey; i++) {
		genomes.push(pool.length ? pool[i % pool.length] : makeGenome(rng));
	}
	const w = makeWorld(cfg, genomes, rng);
	w.gen = src.gen;
	w.curve = src.curve.slice();
	w.champion = src.champion
		? {
				genome: cloneGenome(src.champion.genome),
				fitness: src.champion.fitness,
				gen: src.champion.gen
			}
		: null;
	return w;
}
