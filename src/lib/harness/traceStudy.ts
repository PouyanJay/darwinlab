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

import { makeWorld, stepWorld, seededRng, GEN_DURATION } from '../engine';
import type { WorldConfig, Genome } from '../engine';
import { measureBout, type BehaviorStats } from './behavior';
import { traceBout, type BoutTrace } from './trace';
import type { BehaviorMetric } from '../lab/evidence';

const DT = 1 / 60;

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
 * Run one trace study in time-boxed slices, like `evaluate`. `onProgress` is 0–1 (the evolve loop is the
 * bulk of the work); `signal` cancels between slices, so a study the user walked away from stops.
 */
export async function runTraceStudy(
	{ cfg, episodes = 40, seed = 1 }: TraceStudyRequest,
	{
		budgetMs = 12,
		signal,
		onProgress
	}: { budgetMs?: number; signal?: AbortSignal; onProgress?: (fraction: number) => void } = {}
): Promise<TraceStudy | null> {
	const genDuration = cfg.genDuration ?? GEN_DURATION;
	const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));

	// EVOLVE one population — its own world and seed, nothing shared with the bench.
	const world = makeWorld(structuredClone(cfg), undefined, seededRng(1000 + seed));
	let sliceStart = performance.now();
	while (world.gen < episodes) {
		stepWorld(world, DT);
		if (performance.now() - sliceStart >= budgetMs) {
			if (signal?.aborted) return null;
			onProgress?.((world.gen / episodes) * 0.85); // the evolve loop is ~85% of the work
			await breathe();
			sliceStart = performance.now();
		}
	}
	if (signal?.aborted) return null;

	// Read the curve (pure, off the hot path) and KEEP the genomes the evaluator would have thrown away.
	const curve = [...world.lifeCurve];
	const genomes: Genome[] = (world.roster.length ? world.roster : world.fish).map((f) => f.genome);

	// TRACE + SCORE the evolved population and a random-brain control on the SAME bout seed, so the two
	// small-multiples are directly comparable (same predator, same spawn — only the brains differ).
	const traceSeed = 7000 + seed;
	const behSeed = 9000 + seed;
	const evolved: TraceArm = {
		trace: traceBout({ cfg, genomes, seed: traceSeed, seconds: genDuration }),
		behavior: measureBout(cfg, genomes, behSeed, genDuration)
	};
	onProgress?.(0.93);
	await breathe();
	if (signal?.aborted) return null;

	const control: TraceArm = {
		trace: traceBout({ cfg, genomes: undefined, seed: traceSeed, seconds: genDuration }),
		behavior: measureBout(cfg, undefined, behSeed, genDuration)
	};
	onProgress?.(1);

	return { episodes, curve, evolved, control };
}
