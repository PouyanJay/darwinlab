import { describe, it, expect, beforeEach } from 'vitest';
import { research } from './research.svelte';
import { InThreadExecutor, type JobExecutor } from '../lab/runner';
import { newWorldConfig } from '../engine';
import type { EvalRequest, Evaluation } from '../lab/evaluator';

/**
 * The batch LIFECYCLE — progress, completion, cancel, and the cancel-on-new guard — driven through
 * injected executors so it is deterministic and fast, not through the real worker pool (that path is
 * the runner's own spec). The store is a singleton, so each test cancels it back to idle first.
 */

const tiny = (name: string): EvalRequest => ({
	cfg: { ...newWorldConfig(name, '#888888'), prey: 4, preds: 1 },
	seeds: 1,
	episodes: 1,
	bouts: 1
});

/** An executor whose jobs never finish on their own — only a cancel (signal abort) settles them. */
class HangingExecutor implements JobExecutor {
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

describe('research batch lifecycle', () => {
	beforeEach(() => research.cancel());

	it('runs a batch to completion and ends idle at full progress', async () => {
		expect(research.running).toBe(false); // the state we claim to change really starts here
		const results = await research.run([tiny('a'), tiny('b')], new InThreadExecutor());
		expect(results).not.toBeNull();
		expect(results).toHaveLength(2);
		expect(research.running).toBe(false);
		expect(research.progress).toBe(1);
	});

	it('cancel stops a hanging run and clears the lifecycle', async () => {
		const run = research.run([tiny('a')], new HangingExecutor());
		expect(research.running).toBe(true); // it really started before we cancel it
		research.cancel();
		expect(await run).toBeNull();
		expect(research.running).toBe(false);
		expect(research.progress).toBe(0);
	});

	it('a newer run supersedes the one in flight: the old one resolves null', async () => {
		const first = research.run([tiny('a')], new HangingExecutor()); // hangs, holding the store
		const second = research.run([tiny('b')], new InThreadExecutor()); // aborts the first, then runs

		expect(await first).toBeNull(); // superseded — it owns nothing now
		const secondResults = await second;
		expect(secondResults).not.toBeNull();
		expect(secondResults).toHaveLength(1);
		expect(research.running).toBe(false);
	});
});
