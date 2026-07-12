/**
 * Dump the learning-evidence dataset as JSON (for the diagnostic report):
 *  - Direction world's survival curve across 150 generations
 *  - one 10s bout's trajectories: evolved-150 population vs fresh random, same seed
 *  - the showdown table for all five worlds (mean s/fish, 20 bouts, no evolution)
 * Run: npx vite-node scripts/dump-learning-evidence.ts > /tmp/evidence.json
 */

import { makeWorld, stepWorld, seededRng, DEFAULT_WORLDS } from '../src/lib/engine';
import type { Genome, WorldConfig } from '../src/lib/engine';

const DT = 1 / 60;
const GENS = 150;

function evolveWorld(cfg: WorldConfig, seed: number) {
	const w = makeWorld(cfg, undefined, seededRng(seed));
	let guard = GENS * 5000;
	while (w.gen < GENS && guard-- > 0) stepWorld(w, DT);
	return w;
}

function bout(cfg: WorldConfig, genomes: Genome[] | undefined, seed: number, trace = false) {
	const w = genomes
		? makeWorld(cfg, genomes, seededRng(seed))
		: makeWorld(cfg, undefined, seededRng(seed));
	w.maxGen = 1;
	w.gen = 1;
	const steps = Math.round(10 / DT);
	const lifespans = new Map(w.fish.map((f) => [f, 10]));
	const paths = trace ? new Map(w.fish.map((f) => [f, [] as [number, number][]])) : null;
	const predPath: [number, number][] = [];
	for (let s = 0; s < steps; s++) {
		const before = [...w.fish];
		stepWorld(w, DT);
		for (const f of before) if (!w.fish.includes(f)) lifespans.set(f, (s + 1) * DT);
		if (trace && s % 6 === 0) {
			for (const f of w.fish) paths!.get(f)?.push([f.x, f.y]);
			if (w.preds[0]) predPath.push([w.preds[0].x, w.preds[0].y]);
		}
	}
	const lives = [...lifespans.values()];
	return {
		meanLife: lives.reduce((a, b) => a + b, 0) / lives.length,
		aliveAtEnd: w.fish.length,
		paths: paths ? [...paths.entries()].map(([f, p]) => ({ life: lifespans.get(f)!, p })) : null,
		predPath: trace ? predPath : null,
		bw: cfg.bw,
		bh: cfg.bh
	};
}

const direction = DEFAULT_WORLDS[2];
const evolved = evolveWorld(direction, 1);
const evolvedGenomes = (evolved.roster.length ? evolved.roster : evolved.fish).map((f) => f.genome);

const showdown = DEFAULT_WORLDS.map((cfg) => {
	const w = evolveWorld(cfg, 1);
	const gs = (w.roster.length ? w.roster : w.fish).map((f) => f.genome);
	let ev = 0;
	let rnd = 0;
	const BOUTS = 20;
	for (let s = 1; s <= BOUTS; s++) {
		ev += bout(cfg, gs, 1000 + s).meanLife;
		rnd += bout(cfg, undefined, 1000 + s).meanLife;
	}
	return { world: cfg.name, evolved: ev / BOUTS, random: rnd / BOUTS };
});

console.log(
	JSON.stringify({
		curve: evolved.curve,
		trajEvolved: bout(direction, evolvedGenomes, 1042, true),
		trajRandom: bout(direction, undefined, 1042, true),
		showdown
	})
);
