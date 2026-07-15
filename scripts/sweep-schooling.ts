/**
 * SCHOOLING SPIKE — does flocking evolve on its own?
 *
 * The bet (Phase 14): give the fish a REASON to group (the confusion effect — the shark passes over
 * a surrounded fish for the exposed straggler, so the interior of a school is the safe place) and a
 * MEANS to group (the shoal sense — cohesion + alignment), and schools should emerge from selection
 * alone. Nobody writes the flocking. This measures whether it appears, and it is honest about it:
 * the metric (polarization φ, nearest-neighbour distance) is never an input to fitness, which stays
 * seconds survived. The clean test at the end is the SENSE'S marginal effect, which controls for a
 * confound — confusion keeps more fish alive, and more survivors pack tighter for free.
 *
 * The 2×2 ablation isolates the claim — only the cell with BOTH the pressure and the sense should
 * school. The other three are controls:
 *   confusion off · sense off — nothing at all (baseline)
 *   confusion on  · sense off — a reason to group, but no way to perceive the group (can't act)
 *   confusion off · sense on  — the eyes to group, but grouping doesn't pay (no selection for it)
 *   confusion on  · sense on  — the hypothesis: φ climbs, NND falls, and they out-survive the rest
 *
 * The genome is 14-wide in every cell; the sense is ablated by feeding 0, never by resizing the
 * brain — so the four cells differ only in the two knobs, on equal terms.
 *
 * Run: npx vite-node scripts/sweep-schooling.ts   (GENS=40 EVOSEEDS=2 BOUTS=5)
 */

import { makeWorld, stepWorld, seededRng, DEFAULT_WORLDS, SHOWCASE_OCEAN } from '../src/lib/engine';
import type { WorldConfig, Senses } from '../src/lib/engine';
import { measureSchools } from '../src/lib/harness/schooling';

const DT = 1 / 60;
const GENS = Number(process.env.GENS ?? 40);
const EVO_SEEDS = Array.from({ length: Number(process.env.EVOSEEDS ?? 2) }, (_, i) => i + 1);
const BOUT_SEEDS = Array.from({ length: Number(process.env.BOUTS ?? 5) }, (_, i) => 2000 + i);
const CHECKPOINTS = [0, GENS / 4, GENS / 2, (3 * GENS) / 4, GENS].map((g) => Math.round(g));

/** Full predator senses in every cell; only the shoal sense and confusion vary. */
const FULL: Senses = { dist: true, dir: true, closing: true, walls: true };
const withShoal = (on: boolean): Senses => ({ ...FULL, cohesion: on, align: on });

/** The showcase ocean, its fish carrying the 14-slot shoal brain. Predator speed and prey count
 *  are the two levers most likely to decide whether grouping PAYS — overridable to explore. */
const base: WorldConfig = {
	...structuredClone(DEFAULT_WORLDS[0]),
	...SHOWCASE_OCEAN,
	brainInputs: 14,
	senses: withShoal(false),
	predSpeed: Number(process.env.PREDSPEED ?? SHOWCASE_OCEAN.predSpeed),
	prey: Number(process.env.PREY ?? DEFAULT_WORLDS[0].prey),
	name: 'shoal'
};

const cells = [
	{ label: 'confusion off · sense off', confusion: false, sense: false },
	{ label: 'confusion on  · sense off', confusion: true, sense: false },
	{ label: 'confusion off · sense on ', confusion: false, sense: true },
	{ label: 'confusion on  · sense on ', confusion: true, sense: true }
];

const cfgFor = (confusion: boolean, sense: boolean): WorldConfig => ({
	...base,
	confusion,
	senses: withShoal(sense)
});

/** Evolve a seeded world to `gens` generations and return its final roster genomes. */
function evolveTo(cfg: WorldConfig, seed: number, gens: number) {
	const w = makeWorld(cfg, undefined, seededRng(seed));
	let guard = gens * 5000;
	while (w.gen < gens && guard-- > 0) stepWorld(w, DT);
	if (w.gen < gens) throw new Error(`evolveTo hit the guard at gen ${w.gen}/${gens}`);
	return (w.roster.length ? w.roster : w.fish).map((f) => f.genome);
}

console.log(
	`\nSchooling spike — ${GENS} generations · ${EVO_SEEDS.length} evo seeds · ${BOUT_SEEDS.length} bouts`
);
console.log(
	`  ocean: showcase · 14-slot shoal brain · prey ${base.prey} · predSpeed ${base.predSpeed} · isolation-hunting\n`
);
console.log('  cell                          φ (align)   NND (px)   life');
console.log('  ' + '─'.repeat(60));

const results: { label: string; pol: number; nnd: number; life: number }[] = [];
for (const cell of cells) {
	const cfg = cfgFor(cell.confusion, cell.sense);
	const runs = EVO_SEEDS.map((seed) => {
		const genomes = evolveTo(cfg, seed, GENS);
		return measureSchools(cfg, genomes, BOUT_SEEDS);
	});
	const avg = (pick: (r: (typeof runs)[number]) => number) =>
		runs.reduce((a, r) => a + pick(r), 0) / runs.length;
	const pol = avg((r) => r.polarization);
	const nnd = avg((r) => r.nnd);
	const life = avg((r) => r.meanLife);
	results.push({ label: cell.label, pol, nnd, life });
	console.log(
		`  ${cell.label}   ${pol.toFixed(2).padStart(6)}     ${nnd.toFixed(0).padStart(5)}     ${life.toFixed(2)}s`
	);
}

// Emergence over time — does the on/on cell CLIMB, or was it born aligned? Snapshot φ/NND at
// checkpoints for the hypothesis cell (evo seed 1), so a rising φ + falling NND reads as evolution.
console.log('\n  Emergence of the on/on cell (evo seed 1):');
console.log('    gen      φ (align)   NND (px)');
console.log('    ' + '─'.repeat(34));
const onCfg = cfgFor(true, true);
for (const gp of CHECKPOINTS) {
	const genomes = gp === 0 ? undefined : evolveTo(onCfg, 1, gp);
	const s = measureSchools(onCfg, genomes, BOUT_SEEDS);
	console.log(
		`    ${String(gp).padStart(3)}       ${s.polarization.toFixed(2).padStart(6)}     ${s.nnd.toFixed(0).padStart(5)}`
	);
}

// The verdict — and it must isolate EVOLVED grouping from a confound: confusion keeps more fish
// alive, and more survivors pack closer for free. So on/on-vs-off/off conflates the mechanic with
// evolution. The honest test is the SENSE'S MARGINAL EFFECT — sense-on vs sense-off at the SAME
// confusion. If the sense (the only way to actively seek the group) tightens the school and buys
// life, that tightening is a decision the population evolved, not a by-product of the death rate.
const [none, confNoSense, , both] = results;
const senseNND = confNoSense.nnd - both.nnd; // >0: the sense packs them tighter
const senseLife = both.life - confNoSense.life; // >0: the sense buys survival
console.log('\n  Verdict:');
console.log(
	`    gross (on/on vs baseline): NND ${none.nnd.toFixed(0)} → ${both.nnd.toFixed(0)}px, life ${none.life.toFixed(2)} → ${both.life.toFixed(2)}s`
);
console.log(
	`    SENSE marginal effect (the clean test): NND ${senseNND >= 0 ? '−' : '+'}${Math.abs(senseNND).toFixed(0)}px, life ${senseLife >= 0 ? '+' : ''}${senseLife.toFixed(2)}s`
);
const schooled = senseNND > 8 && senseLife > 0;
console.log(
	`    ${schooled ? '✓ active schooling evolved — the shoal sense earns its keep beyond the density artifact' : '✗ the sense earns nothing — the tightening is a survival artifact, not evolved grouping'}\n`
);
