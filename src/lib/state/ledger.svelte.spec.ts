import { describe, it, expect, beforeEach } from 'vitest';
import { ledger, LEDGER_STORAGE_KEY } from './ledger.svelte';
import type { JobExecutor } from '../lab/runner';
import type { Evaluation } from '../lab/evaluator';

/**
 * The Ledger's verdict + persistence, driven through a canned executor so the measurement is fixed
 * and the verdict is deterministic (a real run's sign is noisy — not something to assert). The store
 * is a singleton, so each test clears it (and its storage) first.
 */

/** Hands back pre-baked evaluations in submit order — arm A first, then arm B. */
class CannedExecutor implements JobExecutor {
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

const evalWith = (returns: number[]) => ({ returns }) as unknown as Evaluation;
const stored = () => JSON.parse(localStorage.getItem(LEDGER_STORAGE_KEY) ?? 'null');

describe('the Ledger', () => {
	beforeEach(() => ledger.clear());

	it('records a supported verdict when arm A beats arm B, and persists it', async () => {
		// "Direction pays more than distance" (an A>B claim): arm A survives longer than arm B.
		await ledger.run(
			'dir-beats-dist',
			new CannedExecutor([evalWith([5, 5, 5]), evalWith([3, 3, 3])])
		);

		const entry = ledger.latestFor('dir-beats-dist');
		expect(entry?.verdict).toBe('supported');
		expect(entry?.delta).toBeCloseTo(2, 6); // 5 − 3
		expect(entry?.arms[0].mean).toBeCloseTo(5, 6); // arm A summarised for the plot
		expect(entry?.arms[1].mean).toBeCloseTo(3, 6); // arm B
		expect(entry?.configHash).toMatch(/^[0-9a-f]{6}$/); // reproducible: it fingerprints the arms

		// …and it is on disk, not just in memory
		expect(stored().entries[0].claimId).toBe('dir-beats-dist');
	});

	it('records a refuted verdict when arm B beats arm A', async () => {
		await ledger.run(
			'dir-beats-dist',
			new CannedExecutor([evalWith([3, 3, 3]), evalWith([5, 5, 5])])
		);
		expect(ledger.latestFor('dir-beats-dist')?.verdict).toBe('refuted');
	});

	it('keeps the record newest-first', async () => {
		await ledger.run('dir-beats-dist', new CannedExecutor([evalWith([5]), evalWith([3])]));
		await ledger.run('walls-pays-alone', new CannedExecutor([evalWith([4]), evalWith([4])]));
		expect(ledger.entries).toHaveLength(2);
		expect(ledger.entries[0].claimId).toBe('walls-pays-alone'); // the most recent run is first
	});

	it('clear forgets the record on disk as well as in memory', async () => {
		await ledger.run('dir-beats-dist', new CannedExecutor([evalWith([5]), evalWith([3])]));
		expect(ledger.entries).toHaveLength(1); // it really recorded before we clear it
		ledger.clear();
		expect(ledger.entries).toHaveLength(0);
		expect(localStorage.getItem(LEDGER_STORAGE_KEY)).toBeNull();
	});
});
