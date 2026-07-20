/**
 * The evaluator — what makes a number on this bench a RESULT rather than a lucky run.
 *
 * A card shows one live population, and one population is one sample: its curve wanders by ±6
 * points between seeds, so reading a ladder off five single runs is reading noise. An evaluation
 * takes the environment as configured, runs it on N INDEPENDENT SEEDS, freezes each evolved
 * population (no evolution while it is being scored), and reports mean ± sd with the n stated.
 *
 * It runs on the main thread in TIME-BOXED SLICES, exactly like the turbo trainer: a sweep is
 * seconds of work, and the alternative to slicing it is a frozen tab. Cancel is honoured between
 * slices, so an evaluation the user walked away from does not go on burning the frame budget.
 *
 * NOTHING here touches the live bench. It clones the config, builds its own worlds, and throws
 * them away — the population you are watching keeps evolving, unobserved by the measurement.
 */

import { makeWorld, stepWorld, seededRng, GEN_DURATION } from '../engine';
import type { WorldConfig, Genome } from '../engine';
import { measureBout, type BehaviorStats } from '../harness/behavior';

const DT = 1 / 60;

/** One environment's evaluation: the numbers, and the honesty about how they were got. */
export interface Evaluation {
	/** Independent evolution seeds the mean is taken over. */
	n: number;
	/** Episodes each replicate was evolved for. */
	episodes: number;
	/** Mean seconds survived per agent, over frozen populations. */
	meanReturn: number;
	/** Standard deviation across seeds, in seconds — the honest error bar. */
	sdReturn: number;
	/** The behavior signatures, averaged across replicates. */
	behavior: BehaviorStats;
	/** Per-seed returns, so a card can plot the spread rather than assert it. */
	returns: number[];
}

export interface EvalRequest {
	cfg: WorldConfig;
	/** Independent evolution seeds. More is tighter and slower; 5 is a real error bar. */
	seeds?: number;
	/** Episodes to evolve each replicate. */
	episodes?: number;
	/** Scoring bouts per replicate, each one generation long. */
	bouts?: number;
}

/** The run size every batched experiment (the Sweep, the Ledger) sets on each of its requests. */
export interface RunSize {
	seeds: number;
	episodes: number;
	bouts: number;
}

/** Mean and (population) standard deviation of a sample. */
function stats(values: number[]): { mean: number; sd: number } {
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
	return { mean, sd: Math.sqrt(variance) };
}

/** Average the behavior signatures across replicates — each is already a mean over bouts. */
function meanBehavior(rows: BehaviorStats[]): BehaviorStats {
	const avg = (pick: (r: BehaviorStats) => number) =>
		rows.reduce((a, r) => a + pick(r), 0) / rows.length;
	return {
		boltRatio: avg((r) => r.boltRatio),
		fleeAngleErrorDeg: avg((r) => r.fleeAngleErrorDeg),
		dodgeRate: avg((r) => r.dodgeRate),
		cornerDeathShare: avg((r) => r.cornerDeathShare),
		cornerTimeShare: avg((r) => r.cornerTimeShare),
		meanPredDistance: avg((r) => r.meanPredDistance),
		meanLife: avg((r) => r.meanLife),
		aliveAtEnd: avg((r) => r.aliveAtEnd),
		lunges: avg((r) => r.lunges),
		deaths: avg((r) => r.deaths)
	};
}

/**
 * Run one evaluation in time-boxed slices.
 *
 * `onProgress` is called with 0–1 so the UI can show that work is happening rather than that the
 * app has hung. `signal` cancels between slices. The generator yields control to the browser
 * roughly every `budgetMs`, which is what keeps the bench painting while its own numbers are
 * being measured.
 */
export async function evaluate(
	{ cfg, seeds = 5, episodes = 30, bouts = 6 }: EvalRequest,
	{
		budgetMs = 12,
		signal,
		onProgress
	}: { budgetMs?: number; signal?: AbortSignal; onProgress?: (fraction: number) => void } = {}
): Promise<Evaluation | null> {
	const genDuration = cfg.genDuration ?? GEN_DURATION;
	const returns: number[] = [];
	const behaviors: BehaviorStats[] = [];
	// One yield point, reused: `await breathe()` hands the frame back so the tab keeps painting.
	const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));

	for (let s = 0; s < seeds; s++) {
		if (signal?.aborted) return null;

		// EVOLVE this replicate — its own world, its own seed, nothing shared with the bench
		const world = makeWorld(structuredClone(cfg), undefined, seededRng(1000 + s));
		let sliceStart = performance.now();
		while (world.gen < episodes) {
			stepWorld(world, DT);
			if (performance.now() - sliceStart >= budgetMs) {
				if (signal?.aborted) return null;
				onProgress?.((s + world.gen / episodes) / seeds);
				await breathe();
				sliceStart = performance.now();
			}
		}

		// SCORE it frozen: the population is the result, so nothing may evolve while it is judged
		const genomes: Genome[] = (world.roster.length ? world.roster : world.fish).map(
			(f) => f.genome
		);
		const rows: BehaviorStats[] = [];
		for (let b = 0; b < bouts; b++) {
			if (signal?.aborted) return null;
			rows.push(measureBout(cfg, genomes, 5000 + s * 100 + b, genDuration));
			await breathe();
		}

		const row = meanBehavior(rows);
		behaviors.push(row);
		returns.push(row.meanLife);
		onProgress?.((s + 1) / seeds);
	}

	const { mean, sd } = stats(returns);
	return {
		n: seeds,
		episodes,
		meanReturn: mean,
		sdReturn: sd,
		behavior: meanBehavior(behaviors),
		returns
	};
}
