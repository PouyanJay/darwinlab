/**
 * Evolve one world to a target generation in time-boxed slices — the loop the evaluator (once per
 * seed) and the behaviour-trace study both run, so the two can never drift on how a population is
 * grown. It hands the frame back roughly every `budgetMs` so the tab keeps painting while the sim
 * evolves, and honours `signal` between slices so a run the user walked away from stops.
 *
 * `onProgress` is 0–1 within THIS single evolution; a caller running several (the evaluator, across
 * its seeds) remaps it. Returns the evolved world, or null if it was cancelled.
 */

import { makeWorld, stepWorld, seededRng } from '../engine';
import type { WorldConfig, World } from '../engine';

const DT = 1 / 60;

export interface EvolveOptions {
	budgetMs?: number;
	signal?: AbortSignal;
	onProgress?: (fraction: number) => void;
}

export async function evolveInSlices(
	cfg: WorldConfig,
	seed: number,
	episodes: number,
	{ budgetMs = 12, signal, onProgress }: EvolveOptions = {}
): Promise<World | null> {
	// Its own world and seed — nothing shared with the live bench.
	const world = makeWorld(structuredClone(cfg), undefined, seededRng(seed));
	let sliceStart = performance.now();
	while (world.gen < episodes) {
		stepWorld(world, DT);
		if (performance.now() - sliceStart >= budgetMs) {
			if (signal?.aborted) return null;
			onProgress?.(world.gen / episodes);
			await new Promise((resolve) => setTimeout(resolve, 0));
			sliceStart = performance.now();
		}
	}
	return signal?.aborted ? null : world;
}
