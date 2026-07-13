/**
 * Evaluations — the store that owns "what have we actually measured?".
 *
 * Kept apart from the bench store on purpose: the bench owns the LIVE populations, which are one
 * sample each and wander by several points between seeds. This owns the RESULTS — the n-seed
 * replicated measurements — and those two things must not be confused, because confusing them is
 * exactly what makes a demo look like a benchmark.
 *
 * Only one evaluation runs at a time. Starting another cancels the one in flight rather than
 * queueing it: the user asked a newer question, and half a stale sweep is worth nothing.
 */

import { evaluate, type Evaluation } from '../lab/evaluator';
import { configHash } from '../lab/run';
import type { WorldConfig } from '../engine';

export interface EvalState {
	/** Which environment this result belongs to. */
	id: string;
	/** The config it was measured at — a result for a config you have since changed is STALE. */
	hash: string;
	result: Evaluation;
}

class EvalStore {
	/** Results by environment id. `$state.raw`: replaced wholesale, never mutated in place. */
	results = $state.raw<Record<string, EvalState>>({});
	/** The environment being evaluated right now, or null. */
	running = $state<string | null>(null);
	/** 0–1 for the one in flight, so the UI shows work rather than a hang. */
	progress = $state(0);

	#controller: AbortController | null = null;

	/**
	 * Whatever was last measured for an environment, stale or not.
	 *
	 * The panel needs this rather than only the still-valid result: a result whose configuration has
	 * moved must be SHOWN, struck through and labelled, not silently swapped back to an empty
	 * "Evaluate" button as if it had never been measured. Hiding it would quietly lose the evidence
	 * that the number and the config disagree — which is the one thing the reader must see.
	 */
	held(id: string): Evaluation | null {
		return this.results[id]?.result ?? null;
	}

	/**
	 * The result for an environment, but ONLY if it still describes its CURRENT configuration.
	 * Change a condition and the old result stops being an answer to the question you are now asking.
	 */
	current(id: string, cfg: WorldConfig): Evaluation | null {
		const held = this.results[id];
		return held && held.hash === configHash([cfg]) ? held.result : null;
	}

	/** True when a result exists for this environment but was measured at a different config. */
	isStale(id: string, cfg: WorldConfig): boolean {
		const held = this.results[id];
		return !!held && held.hash !== configHash([cfg]);
	}

	/** Measure an environment. Cancels any evaluation already in flight. */
	async run(id: string, cfg: WorldConfig, seeds = 5, episodes = 30): Promise<void> {
		this.#controller?.abort();
		const controller = new AbortController();
		this.#controller = controller;
		this.running = id;
		this.progress = 0;

		const result = await evaluate(
			{ cfg: structuredClone(cfg), seeds, episodes },
			{
				signal: controller.signal,
				onProgress: (fraction) => {
					if (this.running === id) this.progress = fraction;
				}
			}
		);

		// A cancelled evaluation must not publish: it would be a partial answer wearing a whole one's
		// clothes. And a NEWER run may have started since — this one no longer owns the store.
		if (!result || controller.signal.aborted || this.#controller !== controller) return;

		this.results = { ...this.results, [id]: { id, hash: configHash([cfg]), result } };
		this.running = null;
		this.progress = 0;
	}

	cancel(): void {
		this.#controller?.abort();
		this.#controller = null;
		this.running = null;
		this.progress = 0;
	}

	/** Forget an environment's result — it is being removed, or reset to random brains. */
	forget(id: string): void {
		if (!(id in this.results)) return;
		const next = { ...this.results };
		delete next[id];
		this.results = next;
	}

	reset(): void {
		this.cancel();
		this.results = {};
	}
}

export const evals = new EvalStore();
