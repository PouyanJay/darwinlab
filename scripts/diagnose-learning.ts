/**
 * Diagnostic: is training real? Run with `npx vite-node scripts/diagnose-learning.ts`.
 *
 * Three measurements, per world:
 *  1. The learning curve — survival per generation across 150 generations (does it climb?).
 *  2. Genome motion — per-generation population mean |weight|, population spread (are the
 *     weights actually moving and then converging, or being reset?).
 *  3. The showdown — the gen-150 population vs a FRESH RANDOM population, dropped into
 *     identical tanks (same seeds), no evolution, 20 bouts of one generation-length each:
 *     mean seconds survived per fish. If evolution taught nothing, these are equal.
 */

import { makeWorld, stepWorld, seededRng, DEFAULT_WORLDS, GLEN } from '../src/lib/engine';
import type { Genome, WorldConfig } from '../src/lib/engine';

const DT = 1 / 60;
const GENS = Number(process.env.GENS ?? 150);
const BOUTS = Number(process.env.BOUTS ?? 20);

const meanAbs = (g: Genome) => {
	let s = 0;
	for (let i = 0; i < GLEN; i++) s += Math.abs(g[i]);
	return s / GLEN;
};
/** Mean pairwise-ish spread: average per-gene std across the population. */
function spread(genomes: Genome[]): number {
	let total = 0;
	for (let i = 0; i < GLEN; i++) {
		const vals = genomes.map((g) => g[i]);
		const m = vals.reduce((a, b) => a + b, 0) / vals.length;
		total += Math.sqrt(vals.reduce((a, v) => a + (v - m) ** 2, 0) / vals.length);
	}
	return total / GLEN;
}

/** One no-evolution bout: fixed genomes vs sharks for one generation-length. Mean s survived. */
function bout(cfg: WorldConfig, genomes: Genome[], seed: number): number {
	const w = makeWorld(cfg, genomes, seededRng(seed));
	w.maxGen = 1; // deployed semantics: nothing respawns, nothing breeds
	w.gen = 1;
	const steps = Math.round(10 / DT); // one GEN_DURATION
	const lifespans = new Map(w.fish.map((f) => [f, 10]));
	for (let s = 0; s < steps; s++) {
		const before = new Set(w.fish);
		stepWorld(w, DT);
		for (const f of before) if (!w.fish.includes(f)) lifespans.set(f, (s + 1) * DT);
	}
	const all = [...lifespans.values()];
	return all.reduce((a, b) => a + b, 0) / all.length;
}

for (const cfg of DEFAULT_WORLDS) {
	const w = makeWorld(cfg, undefined, seededRng(1));
	const gen0 = w.fish.map((f) => f.genome.slice() as Genome);

	// 1+2: evolve with per-generation genome stats
	const evolved = makeWorld(cfg, undefined, seededRng(1));
	const marks: string[] = [];
	let lastGen = 0;
	let guard = GENS * 5000;
	while (evolved.gen < GENS && guard-- > 0) {
		stepWorld(evolved, DT);
		if (evolved.gen !== lastGen) {
			lastGen = evolved.gen;
			if (lastGen % 30 === 0 || lastGen === 1) {
				const gs = evolved.fish.map((f) => f.genome);
				marks.push(
					`    gen ${String(lastGen).padStart(3)}  survival ${((evolved.curve.at(-1) ?? 0) * 100)
						.toFixed(0)
						.padStart(3)}%  champ ${evolved.champion?.fitness.toFixed(1).padStart(5)}s  ` +
						`mean|w| ${gs.length ? (gs.reduce((a, g) => a + meanAbs(g), 0) / gs.length).toFixed(3) : '  n/a'}  spread ${
							gs.length > 1 ? spread(gs).toFixed(3) : 'n/a'
						}`
				);
			}
		}
	}

	// 3: showdown — evolved population vs fresh random population, same bouts
	const evolvedGenomes = (evolved.roster.length ? evolved.roster : evolved.fish).map(
		(f) => f.genome
	);
	let evolvedScore = 0;
	let randomScore = 0;
	for (let s = 1; s <= BOUTS; s++) {
		evolvedScore += bout(cfg, evolvedGenomes, 1000 + s);
		const fresh = makeWorld(cfg, undefined, seededRng(5000 + s));
		randomScore += bout(
			cfg,
			fresh.fish.map((f) => f.genome),
			1000 + s
		);
	}
	evolvedScore /= BOUTS;
	randomScore /= BOUTS;

	const drift =
		evolvedGenomes.length && gen0.length
			? Math.abs(meanAbs(evolvedGenomes[0]) - meanAbs(gen0[0]))
			: 0;
	console.log(`\n${cfg.name}`);
	for (const m of marks) console.log(m);
	console.log(
		`    SHOWDOWN (${BOUTS} bouts × 10s, no evolution): evolved ${evolvedScore.toFixed(
			2
		)}s/fish vs random ${randomScore.toFixed(2)}s/fish  →  ${(
			(evolvedScore / randomScore - 1) *
			100
		).toFixed(0)}% better  (|w| drift from gen0: ${drift.toFixed(3)})`
	);
}
