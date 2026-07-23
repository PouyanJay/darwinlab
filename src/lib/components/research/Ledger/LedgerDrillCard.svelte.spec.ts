import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import LedgerDrillCard from './LedgerDrillCard.svelte';
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

describe('LedgerDrillCard', () => {
	beforeEach(() => {
		ledger.clear();
		app.clearSubject();
		app.resetBase();
	});

	it('shows the drilled record: sentence, verdict, numbers, rationale, and the frozen background', async () => {
		ledger.compose('pressure', { x: 'dir', s: '1.4' });
		await ledger.run(new CannedExecutor([evalWith([5, 5, 5]), evalWith([3, 3, 3])]));

		render(LedgerDrillCard);
		const drill = page.getByTestId('ledger-drill');
		await expect.element(drill).toHaveTextContent('Direction still pays at 1.4× cruise.');
		await expect.element(drill).toHaveTextContent('supported');
		await expect.element(drill).toHaveTextContent('+2.0s'); // Δ · A over B
		await expect.element(drill).toHaveTextContent(ledger.entries[0].configHash);
		await expect.element(drill).toHaveTextContent(`${app.base.prey} prey`); // the shared background
		await expect
			.element(page.getByTestId('drill-rationale'))
			.toHaveTextContent(/clears zero.*supported/);
	});

	it('“Load into composer” refills the composer with the record’s template and slots', async () => {
		ledger.compose('pressure', { x: 'dir', s: '1.4' });
		await ledger.run(new CannedExecutor([evalWith([5]), evalWith([3])]));
		// move the composer elsewhere, so the door has real state to change back
		ledger.compose('rivalry', { x: 'dir', y: 'dist' });
		expect(ledger.template.id).toBe('rivalry');

		render(LedgerDrillCard);
		await page.getByTestId('drill-load-composer').click();
		expect(ledger.template.id).toBe('pressure');
		expect(ledger.values).toEqual({ x: 'dir', s: '1.4' });
	});
});
