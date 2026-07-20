import { describe, it, expect } from 'vitest';
import { runBatch, InThreadExecutor } from './runner';
import { newWorldConfig } from '../engine';
import type { EvalRequest } from './evaluator';

/**
 * Orchestration only, driven through the in-thread executor so it never touches a worker: that the
 * batch returns a result per job in order, aggregates progress to completion, and honours cancel.
 * Jobs are shrunk to the bone (four prey, one predator, one seed, one generation, one bout) so this
 * is milliseconds, not a real measurement — the numbers themselves are the evaluator's job, tested
 * elsewhere.
 */
const tiny = (name: string): EvalRequest => ({
	cfg: { ...newWorldConfig(name, '#888888'), prey: 4, preds: 1 },
	seeds: 1,
	episodes: 1,
	bouts: 1
});

describe('runBatch orchestration', () => {
	it('returns one result per job, in the order given', async () => {
		const results = await runBatch([tiny('a'), tiny('b'), tiny('c')], {}, new InThreadExecutor());
		expect(results).toHaveLength(3);
		for (const result of results) expect(result?.n).toBe(1);
	});

	it('drives aggregate progress to 1', async () => {
		let last = -1;
		await runBatch(
			[tiny('a'), tiny('b')],
			{ onProgress: (fraction) => (last = fraction) },
			new InThreadExecutor()
		);
		expect(last).toBeCloseTo(1, 5);
	});

	it('an empty batch reports complete and returns nothing', async () => {
		let last = -1;
		const results = await runBatch([], { onProgress: (fraction) => (last = fraction) });
		expect(results).toEqual([]);
		expect(last).toBe(1);
	});

	it('a pre-aborted signal runs nothing and returns all null', async () => {
		const controller = new AbortController();
		controller.abort();
		const results = await runBatch(
			[tiny('a'), tiny('b')],
			{ signal: controller.signal },
			new InThreadExecutor()
		);
		expect(results).toEqual([null, null]);
	});
});
