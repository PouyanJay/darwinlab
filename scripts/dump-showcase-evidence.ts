/**
 * Evidence for the showcase world: the reference world vs the showcase world, same seeds,
 * evolved vs random — trajectories + the ladder table. Feeds the visual report.
 * Run: npx vite-node scripts/dump-showcase-evidence.ts > evidence.json
 */

import { makeWorld, stepWorld, seededRng, DEFAULT_WORLDS, GEN_DURATION } from '../src/lib/engine';
import type { Genome, WorldConfig, Fish } from '../src/lib/engine';
import { measureBouts } from '../src/lib/harness/behavior';

const DT = 1 / 60;
const SIMSEC = 1500;
const BOUT_SEEDS = Array.from({ length: 12 }, (_, i) => 1000 + i);

/** The showcase environment (variant V3B — the sweep's winner). */
const SHOWCASE: Partial<WorldConfig> = {
	persistence: false,
	lungeCommit: true,
	genDuration: 30,
	lungeFerocity: 1.3,
	vision: 240,
	agility: 1.4
};

function evolveTo(cfg: WorldConfig, seed: number): Genome[] {
	const gens = Math.max(20, Math.round(SIMSEC / (cfg.genDuration ?? GEN_DURATION)));
	const w = makeWorld(cfg, undefined, seededRng(seed));
	let guard = SIMSEC * 120;
	while (w.gen < gens && guard-- > 0) stepWorld(w, DT);
	return (w.roster.length ? w.roster : w.fish).map((f) => f.genome);
}

/** One traced bout: fish paths, the shark's path, and where each fish died. */
function trace(cfg: WorldConfig, genomes: Genome[] | undefined, seed: number, seconds = 10) {
	const w = genomes
		? makeWorld(cfg, genomes, seededRng(seed))
		: makeWorld(cfg, undefined, seededRng(seed));
	w.maxGen = 1;
	w.gen = 1;
	const steps = Math.round(seconds / DT);
	const paths = new Map<Fish, [number, number][]>(w.fish.map((f) => [f, []]));
	const lives = new Map<Fish, number>(w.fish.map((f) => [f, seconds]));
	const pred: [number, number][] = [];
	for (let s = 0; s < steps; s++) {
		const before = [...w.fish];
		stepWorld(w, DT);
		for (const f of before) if (!w.fish.includes(f)) lives.set(f, (s + 1) * DT);
		if (s % 5 === 0) {
			for (const f of w.fish) paths.get(f)?.push([Math.round(f.x), Math.round(f.y)]);
			if (w.preds[0]) pred.push([Math.round(w.preds[0].x), Math.round(w.preds[0].y)]);
		}
	}
	return {
		bw: cfg.bw,
		bh: cfg.bh,
		alive: w.fish.length,
		mean: [...lives.values()].reduce((a, b) => a + b, 0) / lives.size,
		pred,
		fish: [...paths.entries()].map(([f, p]) => ({ life: +lives.get(f)!.toFixed(1), p }))
	};
}

const direction = DEFAULT_WORLDS[2];
const refCfg: WorldConfig = structuredClone(direction);
const showCfg: WorldConfig = { ...structuredClone(direction), ...SHOWCASE };

const ladder = DEFAULT_WORLDS.map((base) => {
	const rc: WorldConfig = structuredClone(base);
	const sc: WorldConfig = { ...structuredClone(base), ...SHOWCASE };
	const refStats = measureBouts(rc, evolveTo(rc, 1), BOUT_SEEDS);
	const refRand = measureBouts(rc, undefined, BOUT_SEEDS);
	const shoStats = measureBouts(sc, evolveTo(sc, 1), BOUT_SEEDS);
	const shoRand = measureBouts(sc, undefined, BOUT_SEEDS);
	const r1 = (v: number) => Math.round(v * 100) / 100;
	return {
		world: base.name,
		ref: { life: r1(refStats.meanLife), rand: r1(refRand.meanLife) },
		show: {
			life: r1(shoStats.meanLife),
			rand: r1(shoRand.meanLife),
			flee: Math.round(shoStats.fleeAngleErrorDeg),
			fleeRand: Math.round(shoRand.fleeAngleErrorDeg),
			dodge: Math.round(shoStats.dodgeRate * 100),
			dodgeRand: Math.round(shoRand.dodgeRate * 100),
			dist: Math.round(shoStats.meanPredDistance),
			distRand: Math.round(shoRand.meanPredDistance)
		}
	};
});

console.log(
	JSON.stringify({
		ladder,
		tanks: {
			refEvolved: trace(refCfg, evolveTo(refCfg, 1), 1042),
			showEvolved: trace(showCfg, evolveTo(showCfg, 1), 1042),
			showRandom: trace(showCfg, undefined, 1042)
		}
	})
);
