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

/**
 * V3B — the showcase base found by iterations 1–3. Everything below varies ONE thing on top
 * of it: how fast the shark is relative to the fish (fish top speed is 176 px/s; the shark
 * cruises at 200·predSpeed and lunges at 430·predSpeed). At predSpeed 1 the shark simply
 * outruns every fish, so knowing WHICH WAY to flee can only delay death, never prevent it —
 * which is exactly why awareness looked worthless. Drop the cruise below the fish's top
 * speed and fleeing correctly becomes ESCAPING.
 */
const V3B: Partial<WorldConfig> = {
	persistence: false,
	lungeCommit: true,
	genDuration: 30,
	lungeFerocity: 1.3,
	vision: 240,
	agility: 1.4
};

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
	},
	// iteration 2: stamina makes BOLTING the winning strategy (sprint-always drains dry);
	// ferocity makes the lunge undodgeable on position alone (closing speed's unique job)
	STAM: { persistence: false, lungeCommit: true, genDuration: 30, stamina: true },
	FER: { persistence: false, lungeCommit: true, genDuration: 30, lungeFerocity: 1.5 },
	STAMFER: {
		persistence: false,
		lungeCommit: true,
		genDuration: 30,
		stamina: true,
		lungeFerocity: 1.5
	},
	STAMFERW: {
		persistence: false,
		lungeCommit: true,
		genDuration: 30,
		stamina: true,
		lungeFerocity: 1.5,
		wallInstinct: false
	},
	// iteration 3: each pressure works alone and they overdose together — soften both and
	// give fish the runway (vision, agility) to express what they learn
	V3A: {
		persistence: false,
		lungeCommit: true,
		genDuration: 30,
		stamina: true,
		lungeFerocity: 1.3,
		vision: 240,
		agility: 1.4
	},
	V3B: {
		persistence: false,
		lungeCommit: true,
		genDuration: 30,
		lungeFerocity: 1.3,
		vision: 240,
		agility: 1.4
	},
	V3C: {
		persistence: false,
		lungeCommit: true,
		genDuration: 30,
		stamina: true,
		lungeFerocity: 1.3,
		vision: 240,
		agility: 1.4,
		wallInstinct: false
	},

	// iteration 4 — THE SPEED CEILING. Fish max out at 176 px/s. A shark that cruises faster
	// than that runs down even a perfectly-informed fish, so sensing can only ever buy a
	// delay: awareness is capped by physics, not by the brain. Vary the cruise across the
	// fish's own top speed and watch the ladder (Direction ÷ Blind) open up.
	S090: { ...V3B, predSpeed: 0.9 }, // cruise 180 — still just above the fish
	S080: { ...V3B, predSpeed: 0.8 }, // cruise 160 — a fish can now out-swim the cruise
	S070: { ...V3B, predSpeed: 0.7 }, // cruise 140 — fleeing correctly means escaping
	S060: { ...V3B, predSpeed: 0.6 }, // cruise 120 — the lunge is the only real threat left
	// and the same, with the shark still slow but its STRIKE still deadly (the lunge is what
	// a fish must anticipate, so closing speed keeps a job)
	S070F: { ...V3B, predSpeed: 0.7, lungeFerocity: 1.8 },
	S060F: { ...V3B, predSpeed: 0.6, lungeFerocity: 2.0 },

	// iteration 5 — HERD DILUTION. The shark eats whoever is NEAREST, so in a crowd of 20 a
	// smart fish is often spared because a dumber neighbour was closer: individual awareness
	// gets diluted by the herd. Fewer fish per shark ⇒ your own competence is what saves you.
	S070P12: { ...V3B, predSpeed: 0.7, prey: 12 },
	S070P10S1: { ...V3B, predSpeed: 0.7, prey: 10, preds: 1 },
	S070S3: { ...V3B, predSpeed: 0.7, preds: 3 },
	S070FP12: { ...V3B, predSpeed: 0.7, lungeFerocity: 1.8, prey: 12 },

	// iteration 6 — do the two dilution fixes compound? (3 sharks, and fewer fish per shark)
	C1: { ...V3B, predSpeed: 0.7, preds: 3, prey: 12 },
	C2: { ...V3B, predSpeed: 0.7, preds: 3, lungeFerocity: 1.8 },
	C3: { ...V3B, predSpeed: 0.7, preds: 3, prey: 12, lungeFerocity: 1.8 },
	C4: { ...V3B, predSpeed: 0.65, preds: 3, prey: 14 }
};

const wantedVariants = (process.env.VARIANTS ?? Object.keys(VARIANTS).join(',')).split(',');
const wantedWorlds = process.env.WORLDS?.split(',');

for (const vname of wantedVariants) {
	const patch = VARIANTS[vname];
	if (!patch) continue;
	console.log(`\n═══ ${vname}  ${JSON.stringify(patch)}`);
	console.log(
		'  world          life e/r      bolt   flee° (rnd)   dodge (rnd)   ctime (rnd)   dist (rnd)  gens'
	);
	// THE question this sweep exists to answer: what is awareness worth over blindness?
	const lifeByWorld: Record<string, number> = {};
	for (const base of DEFAULT_WORLDS) {
		if (wantedWorlds && !wantedWorlds.includes(base.name)) continue;
		const cfg: WorldConfig = { ...structuredClone(base), ...patch };
		const gens = Math.max(20, Math.round(EVOLVE_SIMSEC / (cfg.genDuration ?? GEN_DURATION)));

		// average over independent evolution seeds — one lineage is a coin toss, not a result
		const evoSeeds = Array.from({ length: Number(process.env.EVOSEEDS ?? 1) }, (_, i) => i + 1);
		const runs = evoSeeds.map((seed) => {
			const w = makeWorld(cfg, undefined, seededRng(seed));
			let guard = EVOLVE_SIMSEC * 120;
			while (w.gen < gens && guard-- > 0) stepWorld(w, DT);
			const genomes = (w.roster.length ? w.roster : w.fish).map((f) => f.genome);
			return { gen: w.gen, stats: measureBouts(cfg, genomes, BOUT_SEEDS) };
		});
		const w = { gen: runs[0].gen };
		const avg = (pick: (s: ReturnType<typeof measureBouts>) => number) =>
			runs.reduce((a, r) => a + pick(r.stats), 0) / runs.length;
		const ev = {
			boltRatio: avg((s) => s.boltRatio),
			fleeAngleErrorDeg: avg((s) => s.fleeAngleErrorDeg),
			dodgeRate: avg((s) => s.dodgeRate),
			cornerDeathShare: avg((s) => s.cornerDeathShare),
			cornerTimeShare: avg((s) => s.cornerTimeShare),
			meanPredDistance: avg((s) => s.meanPredDistance),
			meanLife: avg((s) => s.meanLife),
			aliveAtEnd: avg((s) => s.aliveAtEnd),
			lunges: avg((s) => s.lunges),
			deaths: avg((s) => s.deaths)
		};
		const rnd = measureBouts(cfg, undefined, BOUT_SEEDS);
		const pct = (a: number, b: number) => ((a / b - 1) * 100).toFixed(0).padStart(4);
		console.log(
			`  ${base.name.padEnd(13)} ${ev.meanLife.toFixed(2)}/${rnd.meanLife.toFixed(2)} ${pct(
				ev.meanLife,
				rnd.meanLife
			)}%  ${ev.boltRatio.toFixed(2)}   ${ev.fleeAngleErrorDeg.toFixed(0).padStart(4)} (${rnd.fleeAngleErrorDeg.toFixed(0)})    ` +
				`${(ev.dodgeRate * 100).toFixed(0).padStart(4)}% (${(rnd.dodgeRate * 100).toFixed(0)}%)   ` +
				`${(ev.cornerTimeShare * 100).toFixed(0).padStart(4)}% (${(rnd.cornerTimeShare * 100).toFixed(0)}%)   ` +
				`${ev.meanPredDistance.toFixed(0).padStart(4)} (${rnd.meanPredDistance.toFixed(0)})  ${w.gen}`
		);
		lifeByWorld[base.name] = ev.meanLife;
	}
	const blind = lifeByWorld['Blind drift'];
	const dir = lifeByWorld['Direction'];
	if (blind && dir) {
		console.log(
			`  → AWARENESS PREMIUM: Direction ${dir.toFixed(2)}s vs Blind ${blind.toFixed(2)}s = ` +
				`${((dir / blind - 1) * 100).toFixed(0)}% — what knowing where the threat IS is worth`
		);
	}
}
