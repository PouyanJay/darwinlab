import { describe, it, expect } from 'vitest';
import { WorkerPoolExecutor } from './runner';
import { evaluate, type EvalRequest } from './evaluator';
import { newWorldConfig } from '../engine';

/**
 * The determinism gate — the batch runner's own little fidelity test.
 *
 * A worker runs the SAME `evaluate()` off the main thread; for an identical request it must return
 * identical numbers, because it is the same code driven off the same seeds. If this ever diverges,
 * the worker path is wrong (a bad import, a lost seed) — never loosen it, fix the worker.
 *
 * This lives in the browser (`.svelte.spec`) project because that is where a real Worker and Vite's
 * worker bundling exist; the node orchestration spec covers the rest without one.
 */
const request = (): EvalRequest => ({
	cfg: { ...newWorldConfig('W', '#888888'), prey: 4, preds: 1 },
	seeds: 2,
	episodes: 2,
	bouts: 2
});

describe('the worker pool matches the in-thread evaluator', () => {
	it('produces bit-identical results for an identical request', async () => {
		const pool = new WorkerPoolExecutor(1);
		try {
			const signal = new AbortController().signal;
			const viaWorker = await pool.submit(request(), () => {}, signal);
			const inThread = await evaluate(request());

			expect(viaWorker).not.toBeNull();
			expect(inThread).not.toBeNull();
			expect(viaWorker?.meanReturn).toBe(inThread?.meanReturn);
			expect(viaWorker?.returns).toEqual(inThread?.returns);
		} finally {
			pool.dispose();
		}
	});
});
