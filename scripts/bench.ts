/**
 * Survival bench — the headless science measurement (golden rule #4).
 * Run with `npm run bench:survival`. Slow and statistical, so it never blocks a PR — but it
 * IS a CI consumer: the nightly workflow (.github/workflows/bench.yml) runs it and relies on
 * the exit code below to turn drift into a red run.
 * (The *fidelity* gate — port ≡ reference, bit-exact — lives in src/lib/harness/fidelity.spec.ts.)
 *
 * NOTE ON THE README §8 NUMBERS: they are NOT reproducible from this engine. The vendored,
 * untouched reference/engine2.js produces the same flat ~31–36% band our port does (verified
 * bit-for-bit). We therefore compare against the MEASURED baselines below, not the published
 * §8 figures. See reference/README.md. Do not tune the engine to close that gap.
 */

import { REFERENCE_WORLDS } from '../src/lib/engine';
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

/** Measured converged survival (50 runs × 50 gens) — reference engine and our port agree. */
const MEASURED: Record<string, number> = {
	'Blind drift': 31,
	Distance: 32,
	Direction: 36,
	Anticipation: 35,
	'Corner-wise': 35
};
/** The published (unreproducible) figures, shown for contrast only. */
const PUBLISHED_S8: Record<string, number> = {
	'Blind drift': 24,
	Distance: 32,
	Direction: 59,
	Anticipation: 46,
	'Corner-wise': 43
};

console.log(
	`\nDarwin Lab — survival sweep of the REFERENCE worlds  (${SEEDS} seeds × ${GENERATIONS} generations)\n`
);
// The REFERENCE worlds, on the reference metric: these are the numbers the port is held to, and
// the ones the fidelity gate keeps bit-identical. The shipped bench now runs a different ocean
// (DEFAULT_WORLDS) whose ladder is measured by scripts/sweep-senses.ts — this watch guards the
// science we inherited, which is exactly what must never drift underneath us.
const stats = sweep(REFERENCE_WORLDS, seeds, GENERATIONS, 10);

const pad = (s: string, n: number) => s.padEnd(n);
const num = (v: number, n = 5) => v.toFixed(1).padStart(n);
console.log('  ' + pad('world', 14) + 'measured   ±sd   baseline   (§8, not reproducible)');
console.log('  ' + '─'.repeat(62));
for (const s of stats) {
	console.log(
		'  ' +
			pad(s.name, 14) +
			num(s.meanPct) +
			'%  ' +
			num(s.stdPct, 4) +
			'   ' +
			num(MEASURED[s.name], 5) +
			'      ' +
			num(PUBLISHED_S8[s.name], 4)
	);
}

// The honest finding: Direction is the only sense that pays, and the extras do not stack.
const by = Object.fromEntries(stats.map((s) => [s.name, s.meanPct]));
const directionLeads =
	by['Direction'] >= by['Distance'] &&
	by['Direction'] >= by['Anticipation'] - 1.5 &&
	by['Direction'] >= by['Corner-wise'] - 1.5;
console.log(
	'\n  Direction leads and extras do not stack: ' + (directionLeads ? 'OK ✓' : 'MISMATCH ✗')
);

// Drift watch: a mean wandering off its measured baseline means the science moved — surface it.
// ±5pp is generous against seed noise (the mean of 20 seeds swings ~1–2pp) but far tighter than
// the ~23pp gap to the published Direction figure, so a drifted engine cannot hide inside it.
// findDrift throws for a world with no baseline — silently exempting one is how a rename or a
// sixth world would slip out from under the watch (see src/lib/harness/drift.spec.ts).
const DRIFT_TOLERANCE_PP = 5;
const drifted = findDrift(stats, MEASURED, DRIFT_TOLERANCE_PP);
for (const s of drifted) {
	console.log(
		`  DRIFT ✗ ${s.name}: ${s.meanPct.toFixed(1)}% vs baseline ${MEASURED[s.name]}% ` +
			`(tolerance ±${DRIFT_TOLERANCE_PP}pp)`
	);
}
console.log('  (single runs are noisy — trust the mean over many seeds, not one curve)\n');

// A non-zero exit is what makes the nightly CI run a drift REPORT instead of a green rubber stamp.
if (!directionLeads || drifted.length > 0) process.exitCode = 1;
