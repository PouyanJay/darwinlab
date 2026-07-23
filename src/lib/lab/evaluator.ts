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

import { GEN_DURATION, championGenome, cloneGenome } from '../engine';
import type { WorldConfig, Genome } from '../engine';
import { measureBout, type BehaviorStats } from '../harness/behavior';
import { evolveInSlices } from '../harness/evolve';

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
	/**
	 * The learning curve — mean per-generation survival fraction, averaged across the seeds — present
	 * only when the request opted in (`curve: true`). It is a READ of `World.lifeCurve`, which the
	 * engine already fills during evolution, taken after each seed is fully evolved: no extra evolving,
	 * no touch of the RNG stream, so it cannot perturb anything the fidelity gate measures.
	 */
	curve?: number[];
	/**
	 * Per-seed mean survival of a sealed population of CHAMPION CLONES — the best genome of each
	 * replicate, cloned to the population size and scored on the SAME bout seeds as the evolved
	 * population (a paired comparison: the arena is identical, only the genomes differ). Present
	 * only when the request opted in (`champion: true`) AND at least one replicate had a champion
	 * to clone (a world evolved for zero generations has none).
	 */
	championReturns?: number[];
}

export interface EvalRequest {
	cfg: WorldConfig;
	/** Independent evolution seeds. More is tighter and slower; 5 is a real error bar. */
	seeds?: number;
	/** Episodes to evolve each replicate. */
	episodes?: number;
	/** Scoring bouts per replicate, each one generation long. */
	bouts?: number;
	/**
	 * Capture the learning curve (`Evaluation.curve`). Off by default — a sweep or a landscape runs
	 * hundreds of cells and does not need it (and would ship hundreds of arrays across the worker
	 * boundary); the Ledger and behaviour runs, which answer "did it learn", turn it on.
	 */
	curve?: boolean;
	/** Additionally score champion clones per seed (`Evaluation.championReturns`). Off by default —
	 *  it roughly doubles the scoring bouts, and only the Sweep's "live" toggle asks for it. */
	champion?: boolean;
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

/**
 * Average the per-seed learning curves index-by-index into one curve. Truncates to the shortest
 * (they are equal length in practice — every seed evolves the same number of generations — but a
 * capped or cancelled curve must not read past its end).
 */
export function averageCurves(curves: number[][]): number[] {
	if (curves.length === 0) return [];
	const length = Math.min(...curves.map((c) => c.length));
	const out: number[] = [];
	for (let i = 0; i < length; i++) {
		out.push(curves.reduce((sum, c) => sum + c[i], 0) / curves.length);
	}
	return out;
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
	{
		cfg,
		seeds = 5,
		episodes = 30,
		bouts = 6,
		curve: captureCurve = false,
		champion: scoreChampion = false
	}: EvalRequest,
	{
		budgetMs = 12,
		signal,
		onProgress
	}: { budgetMs?: number; signal?: AbortSignal; onProgress?: (fraction: number) => void } = {}
): Promise<Evaluation | null> {
	const genDuration = cfg.genDuration ?? GEN_DURATION;
	const returns: number[] = [];
	const championReturns: number[] = [];
	const behaviors: BehaviorStats[] = [];
	// Per-seed learning curves, captured read-only after each seed evolves (only when opted in).
	const curves: number[][] = [];
	// One yield point, reused: `await breathe()` hands the frame back so the tab keeps painting.
	const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));

	/** Score one frozen roster over the bouts — the SAME loop for the population and the champion
	 *  clones, so the two passes cannot drift; the seed base is the caller's pairing decision. */
	const scoreBouts = async (
		genomes: Genome[],
		seedBase: number
	): Promise<BehaviorStats[] | null> => {
		const rows: BehaviorStats[] = [];
		for (let b = 0; b < bouts; b++) {
			if (signal?.aborted) return null;
			rows.push(measureBout(cfg, genomes, seedBase + b, genDuration));
			await breathe();
		}
		return rows;
	};

	for (let s = 0; s < seeds; s++) {
		if (signal?.aborted) return null;

		// EVOLVE this replicate in slices — its own seed, nothing shared with the bench. onProgress is
		// remapped from this one evolution's 0–1 to its span of the whole run.
		const world = await evolveInSlices(cfg, 1000 + s, episodes, {
			budgetMs,
			signal,
			onProgress: (fraction) => onProgress?.((s + fraction) / seeds)
		});
		if (!world) return null;

		// Capture this seed's learning curve — a pure read of state the engine already filled while it
		// evolved. Done here, after the evolve loop, so it never sits on the RNG-driven hot path.
		if (captureCurve) curves.push([...world.lifeCurve]);

		// SCORE it frozen: the population is the result, so nothing may evolve while it is judged
		const genomes: Genome[] = (world.roster.length ? world.roster : world.fish).map(
			(f) => f.genome
		);
		const rows = await scoreBouts(genomes, 5000 + s * 100);
		if (!rows) return null;

		const row = meanBehavior(rows);
		behaviors.push(row);
		returns.push(row.meanLife);

		// CHAMPION CLONES, when asked: the replicate's best genome cloned to the population size and
		// scored on the SAME bout seed base — a paired comparison, so the arena cannot take the credit.
		if (scoreChampion) {
			const best = championGenome(world);
			if (best) {
				const champRows = await scoreBouts(
					genomes.map(() => cloneGenome(best)),
					5000 + s * 100
				);
				if (!champRows) return null;
				championReturns.push(meanBehavior(champRows).meanLife);
			}
		}

		onProgress?.((s + 1) / seeds);
	}

	const { mean, sd } = stats(returns);
	return {
		n: seeds,
		episodes,
		meanReturn: mean,
		sdReturn: sd,
		behavior: meanBehavior(behaviors),
		returns,
		...(captureCurve ? { curve: averageCurves(curves) } : {}),
		...(scoreChampion && championReturns.length ? { championReturns } : {})
	};
}
