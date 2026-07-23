/**
 * Test helpers for the landscape design — the singleton walk-backs the store spec and the panel
 * spec share (the sweep.testkit precedent). One source of truth for "what the panel's defaults
 * are", so the two specs cannot drift.
 */

import { landscape } from './landscape.svelte';
import { app } from './app.svelte';
import { CANDIDATE_AXES, LANDSCAPE_DEFAULTS } from '../lab/landscape';
import type { JobExecutor } from '../lab/runner';
import type { EvalRequest, Evaluation } from '../lab/evaluator';

/** Walk the axes, spans, budget, pins and selection back to the catalog defaults, and the app to a
 *  fresh base. */
export function restoreLandscapeDefaults(): void {
	app.clearSubject();
	app.resetBase();
	landscape.setX('predSpeed');
	landscape.setY('mutation');
	for (const axis of CANDIDATE_AXES) landscape.setSpan(axis.key, axis.min, axis.max);
	landscape.setResolution(LANDSCAPE_DEFAULTS.resolution);
	landscape.setSeeds(LANDSCAPE_DEFAULTS.seeds);
	landscape.setEpisodes(LANDSCAPE_DEFAULTS.episodes);
	landscape.clearPins();
	landscape.clearSelection();
}

/** Hands back pre-baked evaluations in submit order — one per cell, row-major. Shared by the store
 *  and component specs, so the two fakes of the worker boundary cannot drift. */
export class CannedExecutor implements JobExecutor {
	readonly concurrency = 1;
	#queue: (Evaluation | null)[];
	constructor(evaluations: (Evaluation | null)[]) {
		this.#queue = [...evaluations];
	}
	async submit(): Promise<Evaluation | null> {
		return this.#queue.shift() ?? null;
	}
	dispose(): void {}
}

/** An executor whose jobs never settle on their own — only a cancel (signal abort) resolves them. */
export class HangingExecutor implements JobExecutor {
	readonly concurrency = 1;
	submit(
		_req: EvalRequest,
		_onProgress: (fraction: number) => void,
		signal: AbortSignal
	): Promise<Evaluation | null> {
		return new Promise((resolve) => {
			if (signal.aborted) return resolve(null);
			signal.addEventListener('abort', () => resolve(null), { once: true });
		});
	}
	dispose(): void {}
}

/** A fake evaluation carrying just the mean the field reads. */
export const evalMean = (meanReturn: number) => ({ meanReturn }) as unknown as Evaluation;
