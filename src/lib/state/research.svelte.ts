/**
 * Research state — the lifecycle of the ONE batch that is running right now.
 *
 * Every Research instrument (the Sweep, the Ledger, the Atlas) turns a question into a list of
 * EvalRequests and hands them here; this store runs them through the batch runner, exposes the
 * progress so the UI shows work rather than a hang, and owns the cancel. Only one batch runs at a
 * time: starting another aborts the one in flight, because the user asked a newer question and half
 * a stale sweep is worth nothing — the same rule the single-card `evals` store follows.
 *
 * It returns the RAW per-job results; each instrument aggregates them its own way (effect sizes, a
 * verdict, a landscape). Nothing here touches the live bench — the runner clones every config.
 */

import { runBatch, type JobExecutor } from '../lab/runner';
import type { EvalRequest, Evaluation } from '../lab/evaluator';

class ResearchStore {
	#running = $state(false);
	#progress = $state(0);
	#controller: AbortController | null = null;

	/** True while a batch is in flight. */
	get running(): boolean {
		return this.#running;
	}

	/** 0–1 across the whole batch, so the UI can show it filling. */
	get progress(): number {
		return this.#progress;
	}

	/**
	 * Run a batch of evaluations, cancelling any batch already in flight.
	 *
	 * Resolves to the per-job results (a null in a slot is a job that failed or was cancelled), or to
	 * `null` for the WHOLE run when a newer run has superseded this one — at which point this call no
	 * longer owns the store and must publish nothing.
	 *
	 * `executor` overrides the runner's default pool — the seam the tests drive, and where a custom
	 * pool would plug in.
	 */
	async run(jobs: EvalRequest[], executor?: JobExecutor): Promise<(Evaluation | null)[] | null> {
		this.#controller?.abort();
		const controller = new AbortController();
		this.#controller = controller;
		this.#running = true;
		this.#progress = 0;

		const results = await runBatch(
			jobs,
			{
				signal: controller.signal,
				onProgress: (fraction) => {
					if (this.#controller === controller) this.#progress = fraction;
				}
			},
			executor
		);

		// A newer run may have started, or this one was cancelled — either way it no longer owns the
		// store, so it publishes nothing.
		if (controller.signal.aborted || this.#controller !== controller) return null;

		this.#running = false;
		this.#progress = 1;
		this.#controller = null;
		return results;
	}

	/** Stop the batch in flight and clear the lifecycle. */
	cancel(): void {
		this.#controller?.abort();
		this.#controller = null;
		this.#running = false;
		this.#progress = 0;
	}
}

export const research = new ResearchStore();
