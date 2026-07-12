/**
 * Survival bench — the headless science measurement (golden rule #4).
 * Run with `npm run bench:survival`. Slow and statistical; not part of CI.
 * (The *fidelity* gate — port ≡ reference, bit-exact — lives in src/lib/harness/fidelity.spec.ts.)
 *
 * NOTE ON THE README §8 NUMBERS: they are NOT reproducible from this engine. The vendored,
 * untouched reference/engine2.js produces the same flat ~31–36% band our port does (verified
 * bit-for-bit). We therefore compare against the MEASURED baselines below, not the published
 * §8 figures. See reference/README.md. Do not tune the engine to close that gap.
 */

import { DEFAULT_WORLDS } from '../src/lib/engine';
import { sweep } from '../src/lib/harness/survival';

const SEEDS = Number(process.env.SEEDS ?? 20);
const GENERATIONS = Number(process.env.GENERATIONS ?? 50);
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

console.log(`\nDarwin Lab — survival sweep  (${SEEDS} seeds × ${GENERATIONS} generations)\n`);
const stats = sweep(DEFAULT_WORLDS, seeds, GENERATIONS, 10);

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
const DRIFT_TOLERANCE_PP = 5;
const drifted = stats.filter((s) => Math.abs(s.meanPct - MEASURED[s.name]) > DRIFT_TOLERANCE_PP);
for (const s of drifted) {
	console.log(
		`  DRIFT ✗ ${s.name}: ${s.meanPct.toFixed(1)}% vs baseline ${MEASURED[s.name]}% ` +
			`(tolerance ±${DRIFT_TOLERANCE_PP}pp)`
	);
}
console.log('  (single runs are noisy — trust the mean over many seeds, not one curve)\n');

// A non-zero exit is what makes the nightly CI run a drift REPORT instead of a green rubber stamp.
if (!directionLeads || drifted.length > 0) process.exitCode = 1;
