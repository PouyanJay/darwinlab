/**
 * The behaviour-trace study — the "training diagnostic", the console's SECOND discovery type.
 *
 * The Sweep/Ledger/Atlas ask which conditions pay; this asks a different question entirely — did ONE
 * population actually learn, and HOW does it survive? It evolves a single population at the subject's
 * config and KEEPS its genomes (the evaluator evolves-then-discards, so this needs its own loop), reads
 * the per-generation learning curve the engine already filled (Q1), then traces and scores that evolved
 * population against a random-brain control on the same frozen bout (Q5). The mechanism is the CONTRAST
 * between the two: an evolved school flees accurately and keeps its distance where random brains don't.
 *
 * It reuses the exact graph library and Report the first discovery type does — a new study slotting into
 * the same seven-question frame is the whole point of RC5. Additive and read-only: no engine change, the
 * curve is a pure read of `World.lifeCurve` after the evolve loop, so the fidelity gate is untouched. A
 * deliberate, time-sliced action (like `evaluate`), never on the batch path.
 */

import { GEN_DURATION } from '../engine';
import type { WorldConfig, Genome } from '../engine';
import { measureBout, type BehaviorStats } from './behavior';
import { traceBout, type BoutTrace } from './trace';
import { evolveInSlices, type EvolveOptions } from './evolve';
import type { BehaviorMetric } from '../lab/evidence';

/** One population traced and scored on the frozen bout — the paths and the behaviour signature. */
export interface TraceArm {
	trace: BoutTrace;
	behavior: BehaviorStats;
}

/** One trace study: the learning curve (Q1) and the evolved-vs-control mechanism (Q5). */
export interface TraceStudy {
	/** Generations the population was evolved for. */
	episodes: number;
	/** Per-generation survival fraction (0–1) of the evolved population — the learning curve, Q1. */
	curve: number[];
	/** The evolved population, and a random-brain control, traced + scored — the mechanism, Q5. */
	evolved: TraceArm;
	control: TraceArm;
}

export interface TraceStudyRequest {
	cfg: WorldConfig;
	/** Generations to evolve. */
	episodes?: number;
	/** Seed for the whole study — the evolution and both bouts derive from it, so it is deterministic. */
	seed?: number;
}

/**
 * The behaviour signatures worth reporting — the ones whose evolved-vs-control gap tells the survival
 * story. Each is measured on both populations; `higherIsBetter` says which direction is competence, so
 * a reader (and the bar chart) knows a shorter flee-error bar is the good one.
 */
export function behaviorMetrics(evolved: BehaviorStats, control: BehaviorStats): BehaviorMetric[] {
	return [
		{
			label: 'Flee-angle error',
			evolved: evolved.fleeAngleErrorDeg,
			control: control.fleeAngleErrorDeg,
			unit: 'deg',
			higherIsBetter: false
		},
		{
			label: 'Dodge rate',
			evolved: evolved.dodgeRate,
			control: control.dodgeRate,
			unit: 'frac',
			higherIsBetter: true
		},
		{
			label: 'Distance kept',
			evolved: evolved.meanPredDistance,
			control: control.meanPredDistance,
			unit: 'px',
			higherIsBetter: true
		},
		{
			label: 'Corner time',
			evolved: evolved.cornerTimeShare,
			control: control.cornerTimeShare,
			unit: 'frac',
			higherIsBetter: false
		}
	];
}

/**
 * Trace and score one population on the frozen bout — the paths and the behaviour signature. Both arms
 * of a study call this with the SAME study seed, so they run the identical bout (same predator, same
 * spawn) and only the brains differ; that shared bout is what makes the evolved-vs-control gap honest.
 */
function traceArm(
	cfg: WorldConfig,
	genomes: Genome[] | undefined,
	seed: number,
	seconds: number
): TraceArm {
	return {
		trace: traceBout({ cfg, genomes, seed: 7000 + seed, seconds }),
		behavior: measureBout(cfg, genomes, 9000 + seed, seconds)
	};
}

/**
 * The headline numbers a study reports — read ONCE here, so the notebook finding and the sidebar
 * summary can never disagree about the same study.
 */
export function traceSummary(study: TraceStudy): {
	finalSurvival: number;
	evolvedSurvivors: number;
	controlSurvivors: number;
	total: number;
} {
	return {
		finalSurvival: study.curve.at(-1) ?? 0,
		evolvedSurvivors: study.evolved.trace.fish.filter((f) => !f.died).length,
		controlSurvivors: study.control.trace.fish.filter((f) => !f.died).length,
		total: study.evolved.trace.fish.length
	};
}

/**
 * The progress split `runTraceStudy` reports: the evolve is the bulk, then the evolved bout, then the
 * control bout. Exported so a caller narrating the stages (the drill's microscope) reads the same
 * boundaries this file emits — restated literals would silently desync if the split were retuned.
 */
export const EVOLVE_PROGRESS_SHARE = 0.85;
export const CONTROL_BOUT_PROGRESS = 0.93;

/**
 * Run one trace study. Evolve one population in time-boxed slices keeping its genomes (the evaluator
 * discards them), then trace it against a random-brain control. `onProgress` is 0–1 (the evolve loop is
 * the bulk of the work); `signal` cancels between slices, so a study the user walked away from stops.
 */
export async function runTraceStudy(
	{ cfg, episodes = 40, seed = 1 }: TraceStudyRequest,
	{ budgetMs = 12, signal, onProgress }: EvolveOptions = {}
): Promise<TraceStudy | null> {
	const seconds = cfg.genDuration ?? GEN_DURATION;

	// Evolve, keeping the population — the evolve loop is the bulk of the work.
	const world = await evolveInSlices(cfg, 1000 + seed, episodes, {
		budgetMs,
		signal,
		onProgress: (fraction) => onProgress?.(fraction * EVOLVE_PROGRESS_SHARE)
	});
	if (!world) return null;

	const curve = [...world.lifeCurve]; // pure read, off the hot path
	const genomes: Genome[] = (world.roster.length ? world.roster : world.fish).map((f) => f.genome);

	const evolved = traceArm(cfg, genomes, seed, seconds);
	onProgress?.(CONTROL_BOUT_PROGRESS);
	if (signal?.aborted) return null;
	const control = traceArm(cfg, undefined, seed, seconds);
	onProgress?.(1);

	return { episodes, curve, evolved, control };
}
