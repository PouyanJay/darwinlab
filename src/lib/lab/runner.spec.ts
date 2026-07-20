import { describe, it, expect } from 'vitest';
import { runBatch, InThreadExecutor, WorkerPoolExecutor, type JobExecutor } from './runner';
import { newWorldConfig } from '../engine';
import type { EvalRequest } from './evaluator';

/**
 * Orchestration driven through the in-thread executor so it never touches a worker, plus the pool's
 * own cancellation/disposal driven through a FAKE worker so those paths are deterministic. Jobs are
 * shrunk to the bone (four prey, one predator, few seeds/generations/bouts) so this is milliseconds,
 * not a real measurement — the numbers themselves are the evaluator's job, tested elsewhere.
 */
const tiny = (name: string): EvalRequest => ({
	cfg: { ...newWorldConfig(name, '#888888'), prey: 4, preds: 1 },
	seeds: 1,
	episodes: 1,
	bouts: 1
});

/** A worker that never answers on its own — it holds its slot until the pool cancels or disposes it. */
class FakeWorker {
	onmessage: ((event: MessageEvent) => void) | null = null;
	postMessage(): void {}
	terminate(): void {}
}
const fakePool = (size: number) =>
	new WorkerPoolExecutor(size, () => new FakeWorker() as unknown as Worker);

describe('runBatch orchestration', () => {
	it("returns each job's result in its own slot, in order", async () => {
		// The jobs differ in `seeds`, which surfaces on the result as `n`, so a slot holding the wrong
		// job's result (or the whole array reversed) is caught — a uniform property never would be.
		const jobs = [
			{ ...tiny('a'), seeds: 1 },
			{ ...tiny('b'), seeds: 2 },
			{ ...tiny('c'), seeds: 3 }
		];
		const results = await runBatch(jobs, {}, new InThreadExecutor());
		expect(results.map((result) => result?.n)).toEqual([1, 2, 3]);
	});

	it('reports progress WITHIN a job, not just a jump to 100% at the end', async () => {
		// One multi-seed job, so honest progress must climb through the middle as its seeds land; a
		// regression that dropped per-job progress would only ever report the terminal 1.
		const seen: number[] = [];
		await runBatch(
			[{ ...tiny('a'), seeds: 4 }],
			{ onProgress: (fraction) => seen.push(fraction) },
			new InThreadExecutor()
		);
		expect(seen.at(-1)).toBeCloseTo(1, 5);
		expect(seen.some((fraction) => fraction > 0 && fraction < 1)).toBe(true);
	});

	it('an empty batch reports complete and returns nothing', async () => {
		let last = -1;
		const results = await runBatch([], { onProgress: (fraction) => (last = fraction) });
		expect(results).toEqual([]);
		expect(last).toBe(1);
	});

	it('a pre-aborted signal SUBMITS nothing and returns all null', async () => {
		// A counting spy, not the in-thread executor: `evaluate()` swallows an abort on its own, so
		// only a spy can prove runBatch never even started the jobs.
		let submits = 0;
		const spy: JobExecutor = {
			concurrency: 1,
			submit: async () => {
				submits++;
				return null;
			},
			dispose() {}
		};
		const controller = new AbortController();
		controller.abort();
		const results = await runBatch([tiny('a'), tiny('b')], { signal: controller.signal }, spy);
		expect(submits).toBe(0);
		expect(results).toEqual([null, null]);
	});
});

describe('WorkerPoolExecutor cancellation and disposal', () => {
	it('a job cancelled while queued resolves null without a worker freeing up', async () => {
		const pool = fakePool(1);
		const holding = pool.submit(tiny('a'), () => {}, new AbortController().signal); // takes the worker
		await Promise.resolve(); // let it claim the only worker before the next job asks

		const queuedSignal = new AbortController();
		const queued = pool.submit(tiny('b'), () => {}, queuedSignal.signal); // no free worker → queued
		queuedSignal.abort();

		expect(await queued).toBeNull(); // cancelled from the queue, not after some other job finished
		pool.dispose();
		await holding; // settled to null by dispose — awaited so it can't leak past the test
	});

	it('dispose settles an in-flight job to null instead of leaking it', async () => {
		const pool = fakePool(1);
		const job = pool.submit(tiny('a'), () => {}, new AbortController().signal);
		await Promise.resolve(); // let the job claim its worker and register as in-flight
		pool.dispose();
		expect(await job).toBeNull();
	});
});
