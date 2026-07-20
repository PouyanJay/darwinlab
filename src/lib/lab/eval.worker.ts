/// <reference lib="webworker" />
/**
 * The evaluation worker — where a Research batch actually runs.
 *
 * It does one thing: receive an EvalRequest, run the SAME `evaluate()` the main thread would, and
 * post progress and the result back. Because the engine and the evaluator are pure (no Svelte, no
 * DOM), this file imports them untouched — the whole point of keeping those layers pure is that
 * they run here, off the main thread, so a thousand-bout sweep never freezes the tab.
 *
 * Cancel is a message, not a kill: aborting the job's controller lets `evaluate()` stop between its
 * time-boxed slices and return null, and the worker lives on to take the next job.
 */

import { evaluate } from './evaluator';
import type { WorkerRequest, WorkerResponse } from './protocol';

// A dedicated worker's global scope. The cast sidesteps the DOM/WebWorker `self` type clash without
// pulling the DOM lib's `Window.postMessage` signature in.
const ctx = self as unknown as DedicatedWorkerGlobalScope;

const controllers = new Map<number, AbortController>();

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
	const message = event.data;

	// The cancel message is the only one carrying `type`, so its presence narrows the union.
	if ('type' in message) {
		controllers.get(message.jobId)?.abort();
		return;
	}

	const { jobId, req } = message;
	const controller = new AbortController();
	controllers.set(jobId, controller);

	const result = await evaluate(req, {
		signal: controller.signal,
		onProgress: (progress) => ctx.postMessage({ jobId, progress } satisfies WorkerResponse)
	});

	controllers.delete(jobId);
	// `result` is null if the job was cancelled mid-flight — the pool resolves that job to null.
	ctx.postMessage({ jobId, result } satisfies WorkerResponse);
};
