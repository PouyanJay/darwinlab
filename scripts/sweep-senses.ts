/**
 * Sense-subset ablation — what is each sense worth ON ITS OWN, and in company?
 *
 * The bench's five worlds are CUMULATIVE (each adds a sense to the one before), which hides
 * the individual verdicts: "Corner-wise" is dist+dir+closing+walls, so if closing is a tax and
 * walls is a gain, the two cancel and the sense that actually works never shows. This runs the
 * combinations directly, in one fixed environment, on equal budgets and several evolution seeds.
 *
 * Run: npx vite-node scripts/sweep-senses.ts   (ENV=w3|showcase|ref, EVOSEEDS=3)
 */

import { makeWorld, stepWorld, seededRng, DEFAULT_WORLDS, GEN_DURATION } from '../src/lib/engine';
import type { WorldConfig, Senses } from '../src/lib/engine';
import { measureBouts } from '../src/lib/harness/behavior';

const DT = 1 / 60;
const SIMSEC = Number(process.env.SIMSEC ?? 1500);
const BOUT_SEEDS = Array.from({ length: 12 }, (_, i) => 1000 + i);
const EVO_SEEDS = Array.from({ length: Number(process.env.EVOSEEDS ?? 3) }, (_, i) => i + 1);

/** The environments worth asking the question in. */
const ENVS: Record<string, Partial<WorldConfig>> = {
	ref: {},
	showcase: {
		persistence: false,
		lungeCommit: true,
		genDuration: 30,
		lungeFerocity: 1.3,
		vision: 240,
		agility: 1.4,
		predSpeed: 0.7,
		preds: 3
	},
	// every sense given a job: walls (no free instinct), closing (a charging wind-up)
	w3: {
		persistence: false,
		lungeCommit: true,
		genDuration: 30,
		lungeFerocity: 1.6,
		vision: 200,
		agility: 1.4,
		predSpeed: 0.7,
		preds: 3,
		wallInstinct: false,
		aimCharge: true
	}
};

const COMBOS: { name: string; senses: Senses }[] = [
	{ name: 'blind', senses: { dist: false, dir: false, closing: false, walls: false } },
	{ name: 'dist', senses: { dist: true, dir: false, closing: false, walls: false } },
	{ name: 'dir', senses: { dist: false, dir: true, closing: false, walls: false } },
	{ name: 'walls', senses: { dist: false, dir: false, closing: false, walls: true } },
	{ name: 'closing', senses: { dist: false, dir: false, closing: true, walls: false } },
	{ name: 'dist+dir', senses: { dist: true, dir: true, closing: false, walls: false } },
	{ name: 'dist+dir+walls', senses: { dist: true, dir: true, closing: false, walls: true } },
	{ name: 'dist+dir+closing', senses: { dist: true, dir: true, closing: true, walls: false } },
	{ name: 'ALL FOUR', senses: { dist: true, dir: true, closing: true, walls: true } }
];

const envName = process.env.ENV ?? 'w3';
const env = ENVS[envName];
if (!env) throw new Error(`unknown ENV "${envName}" (have: ${Object.keys(ENVS).join(', ')})`);

const base = DEFAULT_WORLDS[0]; // one tank, one shark setup — only the SENSES vary

console.log(`\nSense-subset ablation — environment "${envName}"`);
console.log(`  ${JSON.stringify(env)}`);
console.log(`  ${EVO_SEEDS.length} evolution seeds × ${BOUT_SEEDS.length} bouts, equal budgets\n`);
console.log('  senses               life   vs blind   flee°   dodge   corner-time');
console.log('  ' + '─'.repeat(66));

let blindLife = 0;
for (const combo of COMBOS) {
	const cfg: WorldConfig = { ...structuredClone(base), ...env, senses: combo.senses };
	const gens = Math.max(20, Math.round(SIMSEC / (cfg.genDuration ?? GEN_DURATION)));

	const runs = EVO_SEEDS.map((seed) => {
		const w = makeWorld(cfg, undefined, seededRng(seed));
		let guard = SIMSEC * 120;
		while (w.gen < gens && guard-- > 0) stepWorld(w, DT);
		const genomes = (w.roster.length ? w.roster : w.fish).map((f) => f.genome);
		return measureBouts(cfg, genomes, BOUT_SEEDS);
	});
	const avg = (pick: (s: (typeof runs)[number]) => number) =>
		runs.reduce((a, r) => a + pick(r), 0) / runs.length;

	const life = avg((r) => r.meanLife);
	if (combo.name === 'blind') blindLife = life;
	const vsBlind = blindLife ? `${(((life / blindLife) * 100 - 100) | 0).toString()}%` : '—';
	console.log(
		`  ${combo.name.padEnd(20)} ${life.toFixed(2)}s ${vsBlind.padStart(8)}    ` +
			`${avg((r) => r.fleeAngleErrorDeg)
				.toFixed(0)
				.padStart(3)}°    ` +
			`${(avg((r) => r.dodgeRate) * 100).toFixed(0).padStart(3)}%      ` +
			`${(avg((r) => r.cornerTimeShare) * 100).toFixed(0).padStart(3)}%`
	);
}
console.log('');
