/**
 * Survival bench — the headless science measurement (golden rule #4).
 *
 * Run with `npm run bench:survival`. Slow and statistical, so it never blocks a PR — but it IS a
 * CI consumer: the nightly workflow (.github/workflows/bench.yml) runs it and relies on the exit
 * code below to turn drift into a red run.
 *
 * WHAT IT GUARDS. Two things, and they are different claims:
 *
 *  1. THE LADDER. Each sense must keep paying for itself — direction is a leap, walls adds on top,
 *     and distance stays flat (knowing something is NEAR never tells you where to GO; that rung
 *     could not be lifted in any ocean we tried, and we did not fake it). If a change flattens the
 *     ladder, the world stopped rewarding its own inputs and the lab is teaching a lie again.
 *  2. THE NUMBERS. Every world must stay near the baseline it was measured at.
 *
 * Measured on the LIFE metric — mean seconds survived as a share of the generation, which is what
 * fitness actually is and what the tiles plot. The alive-at-the-bell metric flattens to a few
 * percent for every world alike in a tank where nearly everyone dies.
 *
 * (The *fidelity* gate — our engine ≡ the vendored reference, bit-exact — is a separate guard and
 * lives in src/lib/harness/fidelity.spec.ts. It holds the physics we inherited; this holds the
 * science we ship.)
 */

import { DEFAULT_WORLDS } from '../src/lib/engine';
import { sweep, findDrift } from '../src/lib/harness/survival';

// Number('') is 0 and Number('abc') is NaN — either would run a degenerate sweep and report
// it as a science verdict. A bad knob must fail as a bad knob.
function positiveInt(name: string, fallback: number): number {
	const raw = process.env[name];
	if (raw === undefined) return fallback;
	const n = Number(raw);
	if (!Number.isInteger(n) || n <= 0) {
		throw new Error(`${name} must be a positive integer (got "${raw}")`);
	}
	return n;
}

const SEEDS = positiveInt('SEEDS', 20);
const GENERATIONS = positiveInt('GENERATIONS', 50);
const seeds = Array.from({ length: SEEDS }, (_, i) => i + 1);

/**
 * Measured converged life, as a share of the generation (20 seeds × 50 generations, the same
 * settings this script runs at by default). Re-measure — never adjust — if the engine changes.
 */
const MEASURED: Record<string, number> = {
	'Blind drift': 23,
	Distance: 22,
	Direction: 33,
	'Corner-wise': 37,
	'Full senses': 37
};

console.log(`\nDarwin Lab — survival sweep  (${SEEDS} seeds × ${GENERATIONS} generations)\n`);
const stats = sweep(DEFAULT_WORLDS, seeds, GENERATIONS, 10, 'life');

const pad = (s: string, n: number) => s.padEnd(n);
const num = (v: number, n = 5) => v.toFixed(1).padStart(n);
console.log('  ' + pad('world', 14) + ' life/gen    ±sd   baseline');
console.log('  ' + '─'.repeat(46));
for (const s of stats) {
	console.log(
		'  ' +
			pad(s.name, 14) +
			num(s.meanPct) +
			'%  ' +
			num(s.stdPct, 4) +
			'   ' +
			num(MEASURED[s.name], 5)
	);
}

/*
 * The ladder, as a pass/fail. Direction must be a real leap over distance; walls must add on top of
 * it; and distance must stay within touching distance of blindness, because it genuinely buys
 * almost nothing and a bench that claims otherwise is flattering itself.
 */
const by = Object.fromEntries(stats.map((s) => [s.name, s.meanPct]));
const directionLeaps = by['Direction'] - by['Distance'] >= 5;
const wallsPay = by['Corner-wise'] >= by['Direction'] - 1.5;
const sensesBeatBlindness = by['Full senses'] > by['Blind drift'];
const distanceStaysFlat = Math.abs(by['Distance'] - by['Blind drift']) < 8;
const ladderHolds = directionLeaps && wallsPay && sensesBeatBlindness && distanceStaysFlat;

console.log('\n  THE LADDER');
console.log(
	`    direction is a real leap over distance ......... ${directionLeaps ? 'OK ✓' : '✗'}`
);
console.log(`    walls pay on top of direction ................. ${wallsPay ? 'OK ✓' : '✗'}`);
console.log(
	`    every sense beats blindness ................... ${sensesBeatBlindness ? 'OK ✓' : '✗'}`
);
console.log(
	`    distance still barely pays (the honest rung) .. ${distanceStaysFlat ? 'OK ✓' : '✗'}`
);

// Drift watch: a mean wandering off its measured baseline means the science moved — surface it.
// ±6pp is generous against seed noise (these means swing ±2–6pp across 20 seeds) but far tighter
// than the gaps the ladder is made of. findDrift THROWS for a world with no baseline — silently
// exempting one is how a rename or a sixth world slips out from under the watch (drift.spec.ts).
const DRIFT_TOLERANCE_PP = 6;
const drifted = findDrift(stats, MEASURED, DRIFT_TOLERANCE_PP);
for (const s of drifted) {
	console.log(
		`\n  DRIFT ✗ ${s.name}: ${s.meanPct.toFixed(1)}% vs baseline ${MEASURED[s.name]}% ` +
			`(tolerance ±${DRIFT_TOLERANCE_PP}pp)`
	);
}
console.log('  (single runs are noisy — trust the mean over many seeds, not one curve)\n');

// A non-zero exit is what makes the nightly CI run a drift REPORT instead of a green rubber stamp.
if (!ladderHolds || drifted.length > 0) process.exitCode = 1;
