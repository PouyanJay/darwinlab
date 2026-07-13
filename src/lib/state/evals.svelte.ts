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
import { SUBSETS, type AblationRow } from '../lab/ablation';
import type { WorldConfig } from '../engine';

export interface EvalState {
	/** Which environment this result belongs to. */
	id: string;
	/** The config it was measured at — a result for a config you have since changed is STALE. */
	hash: string;
	result: Evaluation;
}

/**
 * An ablation, and the environment it was run IN.
 *
 * The environment is the whole point: a channel is worth exactly what ITS OWN environment makes it
 * worth. A matrix run against some other card's conditions answers a question nobody asked — which
 * is what the first version did, and why this is keyed per card.
 */
export interface AblationState {
	id: string;
	/** Hash of the config the subsets were run in — ablation and evaluation stale independently. */
	hash: string;
	rows: AblationRow[];
}

class EvalStore {
	/** Results by environment id. `$state.raw`: replaced wholesale, never mutated in place. */
	results = $state.raw<Record<string, EvalState>>({});
	/** Ablation results by environment id — each measured IN that environment's own conditions. */
	ablations = $state.raw<Record<string, AblationState>>({});
	/** The environment being evaluated right now, or null. */
	running = $state<string | null>(null);
	/** The environment being ablated right now, or null. */
	ablating = $state<string | null>(null);
	/** 0–1 for the one in flight, so the UI shows work rather than a hang. */
	progress = $state(0);
	/** 0–1 for the ablation in flight. Separate: the two can be looked at side by side. */
	ablationProgress = $state(0);

	#controller: AbortController | null = null;
	#ablationController: AbortController | null = null;

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

	/** The ablation last run for an environment, stale or not (shown struck through when stale). */
	heldAblation(id: string): AblationRow[] | null {
		return this.ablations[id]?.rows ?? null;
	}

	/** True when an ablation exists for this environment but was run in a different configuration. */
	isAblationStale(id: string, cfg: WorldConfig): boolean {
		const held = this.ablations[id];
		return !!held && held.hash !== this.#ablationHash(cfg);
	}

	/**
	 * Run the observation-subset matrix IN THIS ENVIRONMENT.
	 *
	 * Every row is this card's own conditions — its adversaries, its speeds, its tank — with a
	 * different observation space. That is the only version of this measurement that answers the
	 * question the card is asking, because a channel is worth exactly what its own environment
	 * makes it worth: the wall sense pays here and is worthless in a world that avoids walls for
	 * free, and no average over somebody else's tank will tell you which one you are looking at.
	 */
	async ablate(id: string, cfg: WorldConfig, seeds = 3, episodes = 20): Promise<void> {
		this.#ablationController?.abort();
		const controller = new AbortController();
		this.#ablationController = controller;
		this.ablating = id;
		this.ablationProgress = 0;

		const hash = this.#ablationHash(cfg);
		const rows: AblationRow[] = [];
		let blindMean = 0;

		for (const [index, subset] of SUBSETS.entries()) {
			const variant: WorldConfig = { ...structuredClone(cfg), senses: { ...subset.senses } };
			const result = await evaluate(
				{ cfg: variant, seeds, episodes },
				{
					signal: controller.signal,
					onProgress: (fraction) => {
						if (this.ablating === id) this.ablationProgress = (index + fraction) / SUBSETS.length;
					}
				}
			);
			if (!result || controller.signal.aborted || this.#ablationController !== controller) return;

			if (index === 0) blindMean = result.meanReturn;
			rows.push({
				label: subset.label,
				mean: result.meanReturn,
				sd: result.sdReturn,
				// worth OVER BLINDNESS — the comparison that answers "does knowing pay". Measuring
				// against random policies only ever answered "does evolution work".
				vsBlind: blindMean ? (result.meanReturn / blindMean - 1) * 100 : 0
			});
			// published as they land, so the table fills in rather than appearing all at once
			this.ablations = { ...this.ablations, [id]: { id, hash, rows: [...rows] } };
		}

		this.ablating = null;
		this.ablationProgress = 0;
	}

	cancelAblation(): void {
		this.#ablationController?.abort();
		this.#ablationController = null;
		this.ablating = null;
		this.ablationProgress = 0;
	}

	/**
	 * The hash an ablation is keyed on: the environment WITHOUT its observation space.
	 *
	 * The matrix varies the senses itself, so toggling a pill on the card does not invalidate it —
	 * but changing the adversaries, the speeds or the tank does, because those are what the answer
	 * depends on.
	 */
	#ablationHash(cfg: WorldConfig): string {
		return configHash([
			{ ...cfg, senses: { dist: false, dir: false, closing: false, walls: false } }
		]);
	}

	cancel(): void {
		this.#controller?.abort();
		this.#controller = null;
		this.running = null;
		this.progress = 0;
	}

	/** Forget an environment's results — it is being removed, or reset to random brains. */
	forget(id: string): void {
		if (id in this.results) {
			const next = { ...this.results };
			delete next[id];
			this.results = next;
		}
		if (id in this.ablations) {
			const next = { ...this.ablations };
			delete next[id];
			this.ablations = next;
		}
	}

	reset(): void {
		this.cancel();
		this.cancelAblation();
		this.results = {};
		this.ablations = {};
	}
}

export const evals = new EvalStore();
