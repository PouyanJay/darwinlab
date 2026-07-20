/**
 * The batch runner — how Research runs many evaluations without freezing the tab.
 *
 * `runBatch` takes a list of EvalRequests and returns their results in order, reporting aggregate
 * progress and honouring a cancel signal. HOW each job runs is an EXECUTOR:
 *
 *   - WorkerPoolExecutor  runs jobs across a pool of Web Workers (the browser default) — off the
 *                         main thread, one job per free worker, so the live sim keeps painting.
 *   - InThreadExecutor    runs jobs on the calling thread via `evaluate()`'s own time-boxed slices.
 *                         The fallback where Workers are unavailable (server render, unit tests),
 *                         and what the orchestration tests drive so they never depend on a worker.
 *
 * Both produce identical numbers for identical requests — same code, same seeds — which the browser
 * determinism spec pins bit-for-bit. `runBatch` limits how many jobs are in flight to the executor's
 * own concurrency, so it never over-commits the pool.
 */

import { browser } from '$app/environment';
import { evaluate, type EvalRequest, type Evaluation } from './evaluator';

export interface JobExecutor {
	/** How many jobs may run at once — the pool size, or 1 in-thread. */
	readonly concurrency: number;
	/** Run one request; report its 0–1 progress; resolve to its result, or null if cancelled. */
	submit(
		req: EvalRequest,
		onProgress: (fraction: number) => void,
		signal: AbortSignal
	): Promise<Evaluation | null>;
	/** Release any workers held. */
	dispose(): void;
}

/** The fallback: run each job right here, sliced, exactly as a single card's Evaluate does. */
export class InThreadExecutor implements JobExecutor {
	readonly concurrency = 1;

	submit(
		req: EvalRequest,
		onProgress: (fraction: number) => void,
		signal: AbortSignal
	): Promise<Evaluation | null> {
		return evaluate(req, { onProgress, signal });
	}

	dispose(): void {}
}

type OutgoingProgress = { jobId: number; progress: number };
type OutgoingResult = { jobId: number; result: Evaluation | null };
type Outgoing = OutgoingProgress | OutgoingResult;

interface PendingJob {
	onProgress: (fraction: number) => void;
	settle: (result: Evaluation | null) => void;
}

/** A pool of Web Workers, each running the pure evaluator off the main thread. */
export class WorkerPoolExecutor implements JobExecutor {
	readonly concurrency: number;

	#workers: Worker[] = [];
	#free: Worker[] = [];
	#waiting: Array<(worker: Worker) => void> = [];
	#pending = new Map<number, PendingJob>();
	#nextJobId = 0;

	constructor(size: number) {
		this.concurrency = Math.max(1, size);
		for (let i = 0; i < this.concurrency; i++) {
			const worker = new Worker(new URL('./eval.worker.ts', import.meta.url), { type: 'module' });
			worker.onmessage = (event: MessageEvent<Outgoing>) => this.#onMessage(worker, event.data);
			this.#workers.push(worker);
			this.#free.push(worker);
		}
	}

	#onMessage(worker: Worker, message: Outgoing): void {
		const job = this.#pending.get(message.jobId);
		if (!job) return;

		if ('progress' in message) {
			job.onProgress(message.progress);
			return;
		}

		// A result (possibly null) ends the job and frees the worker for the next one.
		this.#pending.delete(message.jobId);
		this.#release(worker);
		job.settle(message.result);
	}

	/** Hand a freed worker to whoever is waiting, or put it back on the free list. */
	#release(worker: Worker): void {
		const next = this.#waiting.shift();
		if (next) next(worker);
		else this.#free.push(worker);
	}

	/** Resolve as soon as a worker is free — immediately if one is idle, else when one frees up. */
	#acquire(): Promise<Worker> {
		const worker = this.#free.pop();
		if (worker) return Promise.resolve(worker);
		return new Promise((resolve) => this.#waiting.push(resolve));
	}

	async submit(
		req: EvalRequest,
		onProgress: (fraction: number) => void,
		signal: AbortSignal
	): Promise<Evaluation | null> {
		if (signal.aborted) return null;

		const worker = await this.#acquire();
		if (signal.aborted) {
			this.#release(worker);
			return null;
		}

		const jobId = this.#nextJobId++;
		return new Promise<Evaluation | null>((resolve) => {
			const onAbort = () => worker.postMessage({ type: 'cancel', jobId });
			signal.addEventListener('abort', onAbort, { once: true });

			this.#pending.set(jobId, {
				onProgress,
				settle: (result) => {
					signal.removeEventListener('abort', onAbort);
					resolve(result);
				}
			});

			worker.postMessage({ jobId, req });
		});
	}

	dispose(): void {
		for (const worker of this.#workers) worker.terminate();
		this.#workers = [];
		this.#free = [];
		this.#waiting = [];
		this.#pending.clear();
	}
}

/** Leave a couple of cores for the main thread and the live sim; never fewer than one worker. */
function poolSize(): number {
	const cores = (browser && navigator.hardwareConcurrency) || 4;
	return Math.max(1, cores - 1);
}

function canUseWorkers(): boolean {
	return browser && typeof Worker !== 'undefined';
}

// One default executor per session, built lazily so no worker spawns during server render or before
// the first batch is actually run.
let sharedExecutor: JobExecutor | null = null;
function defaultExecutor(): JobExecutor {
	if (!sharedExecutor) {
		sharedExecutor = canUseWorkers() ? new WorkerPoolExecutor(poolSize()) : new InThreadExecutor();
	}
	return sharedExecutor;
}

export interface BatchOptions {
	/** Aggregate 0–1 progress across the whole batch. */
	onProgress?: (fraction: number) => void;
	/** Cancel: in-flight jobs settle to null, unstarted ones never start. */
	signal?: AbortSignal;
}

/**
 * Run every request, at most `executor.concurrency` at once, and return the results in the order the
 * jobs were given. A cancelled or failed job lands as null in its slot — the caller filters.
 */
export async function runBatch(
	jobs: EvalRequest[],
	{ onProgress, signal }: BatchOptions = {},
	executor: JobExecutor = defaultExecutor()
): Promise<(Evaluation | null)[]> {
	const results: (Evaluation | null)[] = new Array(jobs.length).fill(null);
	if (jobs.length === 0) {
		onProgress?.(1);
		return results;
	}

	const perJobProgress = new Array(jobs.length).fill(0);
	const report = () => onProgress?.(perJobProgress.reduce((a, b) => a + b, 0) / jobs.length);

	let nextIndex = 0;
	const lane = async (): Promise<void> => {
		while (true) {
			if (signal?.aborted) return;
			const index = nextIndex++;
			if (index >= jobs.length) return;

			results[index] = await executor.submit(
				jobs[index],
				(fraction) => {
					perJobProgress[index] = fraction;
					report();
				},
				signal ?? new AbortController().signal
			);
			perJobProgress[index] = 1;
			report();
		}
	};

	const lanes = Math.min(executor.concurrency, jobs.length);
	await Promise.all(Array.from({ length: lanes }, lane));
	return results;
}
