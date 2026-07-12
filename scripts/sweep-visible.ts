/**
 * Environment sweep — which world settings make evolved behavior VISIBLE?
 * Run: npx vite-node scripts/sweep-visible.ts   (VARIANTS/WORLDS env to filter)
 *
 * For each variant: evolve every world on an equal sim-second budget, then score the
 * narration's four visible claims (bolt, flee-the-right-way, dodge, corner avoidance) on
 * the frozen evolved population vs a fresh random one, across seeded bouts. The ladder
 * has to EMERGE from these numbers — nothing here scripts a fish.
 */

import { makeWorld, stepWorld, seededRng, DEFAULT_WORLDS, GEN_DURATION } from '../src/lib/engine';
import type { WorldConfig } from '../src/lib/engine';
import { measureBouts } from '../src/lib/harness/behavior';

const DT = 1 / 60;
const EVOLVE_SIMSEC = Number(process.env.SIMSEC ?? 1500); // 150 reference generations
const BOUT_SEEDS = Array.from({ length: Number(process.env.BOUTS ?? 12) }, (_, i) => 1000 + i);

const VARIANTS: Record<string, Partial<WorldConfig>> = {
	REF: {},
	P0: { persistence: false },
	P0LC: { persistence: false, lungeCommit: true },
	P0LCG30: { persistence: false, lungeCommit: true, genDuration: 30 },
	SHOW: { persistence: false, lungeCommit: true, genDuration: 30, agility: 1.6 },
	// walls have to be learnable for the walls-sense rungs, so the instinct comes off there
	SHOWW: {
		persistence: false,
		lungeCommit: true,
		genDuration: 30,
		agility: 1.6,
		wallInstinct: false
	}
};

const wantedVariants = (process.env.VARIANTS ?? Object.keys(VARIANTS).join(',')).split(',');
const wantedWorlds = process.env.WORLDS?.split(',');

for (const vname of wantedVariants) {
	const patch = VARIANTS[vname];
	if (!patch) continue;
	console.log(`\n═══ ${vname}  ${JSON.stringify(patch)}`);
	console.log(
		'  world          life e/r      bolt   flee° (rnd)   dodge (rnd)   corner (rnd)  gens'
	);
	for (const base of DEFAULT_WORLDS) {
		if (wantedWorlds && !wantedWorlds.includes(base.name)) continue;
		const cfg: WorldConfig = { ...structuredClone(base), ...patch };
		const gens = Math.max(20, Math.round(EVOLVE_SIMSEC / (cfg.genDuration ?? GEN_DURATION)));

		const w = makeWorld(cfg, undefined, seededRng(1));
		let guard = EVOLVE_SIMSEC * 120;
		while (w.gen < gens && guard-- > 0) stepWorld(w, DT);
		const genomes = (w.roster.length ? w.roster : w.fish).map((f) => f.genome);

		const ev = measureBouts(cfg, genomes, BOUT_SEEDS);
		const rnd = measureBouts(cfg, undefined, BOUT_SEEDS);
		const pct = (a: number, b: number) => ((a / b - 1) * 100).toFixed(0).padStart(4);
		console.log(
			`  ${base.name.padEnd(13)} ${ev.meanLife.toFixed(2)}/${rnd.meanLife.toFixed(2)} ${pct(
				ev.meanLife,
				rnd.meanLife
			)}%  ${ev.boltRatio.toFixed(2)}   ${ev.fleeAngleErrorDeg.toFixed(0).padStart(4)} (${rnd.fleeAngleErrorDeg.toFixed(0)})    ` +
				`${(ev.dodgeRate * 100).toFixed(0).padStart(4)}% (${(rnd.dodgeRate * 100).toFixed(0)}%)   ` +
				`${(ev.cornerDeathShare * 100).toFixed(0).padStart(4)}% (${(rnd.cornerDeathShare * 100).toFixed(0)}%)  ${w.gen}`
		);
	}
}
