import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import RecordFeed from './RecordFeed.svelte';
import { app, ledger } from '$lib/state';
import type { JobExecutor } from '$lib/lab/runner';
import type { Evaluation } from '$lib/lab/evaluator';

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

describe('RecordFeed', () => {
	beforeEach(() => {
		ledger.clear();
		app.clearSubject();
		app.resetBase();
	});

	it('with no records, says how to make one instead of rendering an empty table', async () => {
		render(RecordFeed);
		await expect
			.element(page.getByTestId('record-feed'))
			.toHaveTextContent(/No verdicts yet — compose a claim/);
	});

	it('renders one row per settled record with its verdict, delta and fingerprint', async () => {
		ledger.compose('rivalry', { x: 'dir', y: 'dist' });
		await ledger.run(new CannedExecutor([evalWith([5, 5, 5]), evalWith([3, 3, 3])]));
		ledger.compose('solo', { x: 'walls' });
		await ledger.run(new CannedExecutor([evalWith([3, 3, 3]), evalWith([5, 5, 5])]));

		render(RecordFeed);
		const rows = page.getByRole('option');
		expect(rows.elements()).toHaveLength(2);
		// newest first: the refuted solo run leads
		await expect.element(rows.first()).toHaveTextContent('The walls sense pays on its own.');
		await expect.element(rows.first()).toHaveTextContent('refuted');
		await expect.element(rows.first()).toHaveTextContent('Δ-2.0s'); // formatSignedSeconds' ASCII minus
		await expect.element(rows.first()).toHaveTextContent(ledger.entries[0].configHash);
	});

	it('clicking a row opens it in the drill — the selection reaches the store', async () => {
		ledger.compose('rivalry', { x: 'dir', y: 'dist' });
		await ledger.run(new CannedExecutor([evalWith([5]), evalWith([3])]));
		ledger.compose('solo', { x: 'walls' });
		await ledger.run(new CannedExecutor([evalWith([5]), evalWith([3])]));
		expect(ledger.selected?.claimId).toBe('walls-pays-alone'); // the fresh verdict starts drilled

		render(RecordFeed);
		await page.getByRole('option', { name: /Direction pays more than distance/ }).click();
		expect(ledger.selected?.claimId).toBe('dir-beats-dist'); // the click reached the store
	});
});
