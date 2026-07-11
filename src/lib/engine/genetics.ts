/**
 * The genetic algorithm's pure operators. Faithful port of engine2.js.
 *
 * Nobody writes "flee the shark" — fleeing emerges because non-fleers get eaten and the
 * survivors breed. `breed` builds the next generation's genomes (champion + elites copied
 * verbatim, the rest tournament-selected crossover + mutation). The world-state side of a
 * generation boundary (curve, champion, gen, respawn) lives in world.ts `evolve`, which
 * calls `breed` — keeping this module free of any World dependency.
 *
 * RNG draw order is preserved exactly from the original so seeded runs are reproducible.
 */

import { GLEN } from './network';
import {
	ELITE_FRACTION,
	TOURNAMENT_BIAS,
	MUTATION_BASE,
	MUTATION_RATE_SCALE,
	MUTATION_PROB,
	MUTATION_RESET_RATE,
	GENOME_INIT_SCALE
} from './constants';
import { randn, type Rng, defaultRng } from './rng';
import type { Genome, WorldConfig, Champion } from './types';

/** Copy a genome (preserves the Float64Array type). */
export function cloneGenome(g: Genome): Genome {
	return g.slice();
}

/** Uniform crossover: each gene taken 50/50 from either parent. */
export function crossover(a: Genome, b: Genome, rng: Rng = defaultRng): Genome {
	const g = new Float64Array(GLEN);
	for (let i = 0; i < GLEN; i++) g[i] = rng() < 0.5 ? a[i] : b[i];
	return g;
}

/**
 * Mutate in place and return the same genome. Each weight is perturbed by a gaussian of
 * std `0.06 + rate*1.7` with probability 0.85, plus a rare full reset (`rate*0.25` chance).
 * So the mutation-rate slider genuinely drives genetic drift.
 */
export function mutate(g: Genome, rate: number, rng: Rng = defaultRng): Genome {
	const s = MUTATION_BASE + rate * MUTATION_RATE_SCALE;
	for (let i = 0; i < GLEN; i++) {
		if (rng() < MUTATION_PROB) g[i] += randn(rng) * s;
		if (rng() < rate * MUTATION_RESET_RATE) g[i] = randn(rng) * GENOME_INIT_SCALE;
	}
	return g;
}

/**
 * Build the next generation's genome list from the ranked roster (best first). Layout:
 * champion (best-ever, preserved) + top-12% elites copied straight through, then the
 * remainder bred by tournament-selected (biased toward the top half) crossover + mutation.
 *
 * Expects `ranked` to be the FULL generation roster (length = cfg.prey), matching the
 * original — tournament indexing assumes at least that many entries.
 */
export function breed(
	ranked: readonly { genome: Genome }[],
	cfg: WorldConfig,
	champion: Champion | null,
	rng: Rng = defaultRng
): Genome[] {
	const next: Genome[] = [];
	if (champion) next.push(cloneGenome(champion.genome)); // preserve best-ever (elitism)
	const elite = Math.max(1, Math.round(cfg.prey * ELITE_FRACTION));
	for (let i = 0; i < elite && i < ranked.length && next.length < cfg.prey; i++) {
		next.push(cloneGenome(ranked[i].genome));
	}
	// The reference floors the tournament window at 2, which would index past the end of a
	// 1-entry roster (`ranked[1]` → undefined → TypeError). Clamp to the roster length: for
	// any valid population (prey ≥ 2, per the spec) this is identical to the reference, so
	// the bit-exact fidelity gate is unaffected — it only makes the degenerate case survive.
	const half = Math.min(ranked.length, Math.max(2, Math.floor(ranked.length / 2)));
	const pick = () => ranked[Math.floor(Math.pow(rng(), TOURNAMENT_BIAS) * half)];
	while (next.length < cfg.prey) {
		const child = crossover(pick().genome, pick().genome, rng);
		mutate(child, cfg.mutation, rng);
		next.push(child);
	}
	return next;
}
