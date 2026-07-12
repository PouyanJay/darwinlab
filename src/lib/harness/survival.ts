/**
 * Headless survival harness (golden rule #4). Drives the PURE engine — no DOM, no Svelte —
 * to measure converged survival per world across seeds, so we can verify the port
 * reproduces the README §8 finding before trusting any UI.
 *
 * A world is stepped at the same fixed dt (1/60) the app uses; convergence happens in the
 * first ~8–10 generations, so a run of ~30 gens is well past steady state. "Survival" is
 * the mean of the last `tail` smoothed-curve points (the curve is an EMA of the fraction
 * that survived each generation — unbiased at steady state).
 */

import { makeWorld, stepWorld, seededRng } from '../engine';
import type { WorldConfig } from '../engine';

const DT = 1 / 60;

export interface RunResult {
	/** Converged survival fraction (0–1) — mean of the last `tail` curve points. */
	survival: number;
	finalGen: number;
	curve: number[];
}

/** Evolve one seeded world for `generations` generations and return its converged survival. */
export function runWorld(cfg: WorldConfig, seed: number, generations: number, tail = 8): RunResult {
	const w = makeWorld(cfg, undefined, seededRng(seed));
	const maxSteps = generations * 5000; // safety valve (a generation is ≤ 600 steps)
	let steps = 0;
	while (w.gen < generations && steps < maxSteps) {
		stepWorld(w, DT);
		steps++;
	}
	// Never return a silently truncated measurement — the science gate trusts these numbers.
	if (w.gen < generations) {
		throw new Error(
			`runWorld("${cfg.name}", seed=${seed}) hit the ${maxSteps}-step safety valve at generation ` +
				`${w.gen}/${generations}. The survival number would be measured from an incomplete run.`
		);
	}
	const k = Math.min(tail, w.curve.length);
	const survival = k ? w.curve.slice(-k).reduce((a, b) => a + b, 0) / k : 0;
	return { survival, finalGen: w.gen, curve: w.curve.slice() };
}

export interface SweepStat {
	name: string;
	/** Mean converged survival across seeds, as a percentage (0–100). */
	meanPct: number;
	/** Standard deviation across seeds, in percentage points. */
	stdPct: number;
	/** Per-seed converged survival percentages. */
	valuesPct: number[];
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Worlds whose mean wandered more than `tolerancePp` off their recorded baseline.
 *
 * A world with NO baseline throws instead of passing: `meanPct - undefined` is NaN, and
 * `NaN > tolerance` is false — so a renamed or newly added world would otherwise be
 * silently exempt from the very drift watch that exists to catch it.
 */
export function findDrift(
	stats: SweepStat[],
	baselines: Record<string, number>,
	tolerancePp: number
): SweepStat[] {
	const missing = stats.filter((s) => !(s.name in baselines));
	if (missing.length) {
		throw new Error(
			`No drift baseline for: ${missing.map((s) => s.name).join(', ')} — ` +
				'a world the watch cannot judge must fail loudly, not pass silently. Measure it and add it.'
		);
	}
	return stats.filter((s) => Math.abs(s.meanPct - baselines[s.name]) > tolerancePp);
}

/** Run every config across every seed and summarize converged survival per world. */
export function sweep(
	cfgs: WorldConfig[],
	seeds: number[],
	generations: number,
	tail = 8
): SweepStat[] {
	return cfgs.map((cfg) => {
		const valuesPct = seeds.map((s) => runWorld(cfg, s, generations, tail).survival * 100);
		const m = mean(valuesPct);
		const variance = mean(valuesPct.map((v) => (v - m) ** 2));
		return { name: cfg.name, meanPct: m, stdPct: Math.sqrt(variance), valuesPct };
	});
}
