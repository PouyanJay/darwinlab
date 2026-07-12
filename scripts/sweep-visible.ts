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
	C4: { ...V3B, predSpeed: 0.65, preds: 3, prey: 14 },

	// iteration 7 — PROPRIOCEPTION. The 9th brain input: the fish's own speed. Whether it
	// pays is a measurement, not a hope; if the honest answer is "it doesn't", that is a
	// finding and it ships as one (golden rules #1/#2).
	SHOWCASE: { ...V3B, predSpeed: 0.7, preds: 3 }, // the locked world, 8-input brains
	SPD: {
		...V3B,
		predSpeed: 0.7,
		preds: 3,
		brainInputs: 9 // the slot exists...
		// ...and each world's `senses.speed` (set below, per-world) decides if it is fed
	},

	// iteration 8 — WHY it doesn't pay. Two fair objections to test before calling it:
	//   (a) a 74-weight brain searches a bigger space on the same budget — run it longer;
	//   (b) knowing your own speed is idle information in a world where speed COSTS nothing.
	//       Turn stamina on and speed becomes a RESOURCE you must manage — now the input has
	//       a job only it can do. If it pays here and nowhere else, that IS the thesis.
	STAM_NOSPD: { ...V3B, predSpeed: 0.7, preds: 3, stamina: true },
	STAM_SPD: { ...V3B, predSpeed: 0.7, preds: 3, stamina: true, brainInputs: 9 },

	// iteration 9 — WHY A SENSE CAN HURT, and how to fix it honestly.
	//
	// An extra input should never hurt: evolution could zero its weights. But every weight is
	// mutated with p=0.85 per generation, so a live-but-USELESS input is a noise channel that
	// mutation keeps re-opening — selection pushes those weights to zero, mutation pushes them
	// back, and the equilibrium is a permanent tax. That tax is only worth paying if the sense
	// solves a problem the fish actually HAS. In the reference world neither extra sense does:
	//   - walls: every fish gets a free 460-unit wall-avoidance INSTINCT, so wall-sensing
	//     solves a problem it does not have. Take the instinct away and the sense has a job.
	//   - closing: the reference lunge re-aims every frame, so there is nothing to anticipate.
	//     Commit the strike (and make it fierce) and feeling it coming becomes the only escape.
	L1: { ...V3B, predSpeed: 0.7, preds: 3, wallInstinct: false },
	L2: { ...V3B, predSpeed: 0.7, preds: 3, wallInstinct: false, lungeFerocity: 1.7 },
	L3: { ...V3B, predSpeed: 0.7, preds: 3, wallInstinct: false, lungeFerocity: 2.1 },

	// iteration 10 — the LAST reason a sense was a tax: the reference wind-up BRAKES, so
	// closing speed bottoms out exactly when the strike is imminent. The sense was not merely
	// useless, it was ANTI-correlated with danger. Charge instead of coiling and it can
	// finally predict the lunge. (aimCharge is why closing has a job; wallInstinct off is
	// why walls has one; predSpeed 0.7 is why direction has one.)
	W1: { ...V3B, predSpeed: 0.7, preds: 3, wallInstinct: false, aimCharge: true },
	W2: {
		...V3B,
		predSpeed: 0.7,
		preds: 3,
		wallInstinct: false,
		aimCharge: true,
		lungeFerocity: 1.6
	},
	W3: {
		...V3B,
		predSpeed: 0.7,
		preds: 3,
		wallInstinct: false,
		aimCharge: true,
		lungeFerocity: 1.6,
		vision: 200
	}
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
		// a 9-input world FEEDS the proprioceptive slot; the ablation semantics are the usual
		// ones (the slot exists either way, off means it receives 0)
		if (cfg.brainInputs === 9) cfg.senses = { ...cfg.senses, speed: true };
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
	// The ladder, rung by rung: what does EACH added sense pay over the world below it? A
	// negative number means that sense is a net tax — the world gives it nothing unique to do.
	const rungs = ['Blind drift', 'Distance', 'Direction', 'Anticipation', 'Corner-wise'];
	const adds = ['+distance', '+direction', '+closing', '+walls'];
	const marginal: string[] = [];
	for (let i = 1; i < rungs.length; i++) {
		const below = lifeByWorld[rungs[i - 1]];
		const here = lifeByWorld[rungs[i]];
		if (below && here) {
			const pct = ((here / below - 1) * 100).toFixed(0);
			marginal.push(`${adds[i - 1]} ${pct.padStart(3)}%`);
		}
	}
	if (marginal.length) console.log(`  → MARGINAL VALUE OF EACH SENSE: ${marginal.join('  ·  ')}`);

	const blind = lifeByWorld['Blind drift'];
	const dir = lifeByWorld['Direction'];
	if (blind && dir) {
		console.log(
			`  → AWARENESS PREMIUM: Direction ${dir.toFixed(2)}s vs Blind ${blind.toFixed(2)}s = ` +
				`${((dir / blind - 1) * 100).toFixed(0)}% — what knowing where the threat IS is worth`
		);
	}
}
