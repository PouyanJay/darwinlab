import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import LedgerDesignPanel from './LedgerDesignPanel.svelte';
import { app, ledger, LEDGER_SEED_LIMITS } from '$lib/state';

/**
 * The composer panel's EDITING contract: a pick made in the panel must land in the ledger store
 * (which owns resolution and clamping) — asserted against the store, not the panel's own display,
 * so a panel that renders a pick it never committed fails loudly. Slot resolution maths has its own
 * spec (hypothesis.spec); this one proves the panel is wired to it.
 *
 * Selects commit on `change`, which Svelte 5 DELEGATES to the app root — a dispatched event must
 * BUBBLE to be heard (the SubjectCard spec found that the hard way).
 */
const pick = (el: Element, value: string) => {
	(el as HTMLSelectElement).value = value;
	el.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('LedgerDesignPanel', () => {
	beforeEach(() => {
		ledger.clear();
		app.clearSubject();
		app.resetBase();
		ledger.compose('rivalry', { x: 'dir', y: 'dist' });
		ledger.setSeeds(LEDGER_SEED_LIMITS.fallback);
	});

	it('offers every template family, with the picked one checked', async () => {
		render(LedgerDesignPanel);
		const radios = page.getByRole('radio');
		expect(radios.elements()).toHaveLength(ledger.templates.length);
		await expect
			.element(page.getByRole('radio', { name: /Rivalry/ }))
			.toHaveAttribute('aria-checked', 'true');
	});

	it('picking a family reaches the store and swaps the slots', async () => {
		render(LedgerDesignPanel);
		await page.getByRole('radio', { name: /Stacking/ }).click();
		expect(ledger.template.id).toBe('stack'); // the pick reached the store
		await expect.element(page.getByLabelText('added sense')).toBeVisible(); // its slots rendered
	});

	it('a slot pick lands in the store and recomposes the claim sentence', async () => {
		render(LedgerDesignPanel);
		const senseY = page.getByLabelText('sense Y');
		expect(ledger.values.y).not.toBe('walls'); // the state we claim to change starts elsewhere
		pick(senseY.element(), 'walls');
		expect(ledger.values.y).toBe('walls');
		await expect
			.element(page.getByTestId('ledger-claim-preview'))
			.toHaveTextContent('Direction pays more than walls.');
	});

	it('a sense slot never offers its sibling’s pick — a sense cannot rival itself', async () => {
		render(LedgerDesignPanel);
		const options = [...page.getByLabelText('sense Y').element().querySelectorAll('option')];
		expect(options.map((o) => o.value)).not.toContain(ledger.values.x);
	});

	it('own speed is disabled with the reason on an 8-wire subject, enabled on a 9-wire one', async () => {
		render(LedgerDesignPanel);
		const gated = () =>
			[...page.getByLabelText('sense Y').element().querySelectorAll('option')].find(
				(o) => o.value === 'speed'
			) as HTMLOptionElement;
		expect(gated().disabled).toBe(true);
		expect(gated().textContent).toMatch(/9-input brain/); // the reason is shown, not a silent drop
		app.setBaseBrainInputs(9);
		await expect.poll(() => gated().disabled).toBe(false);
	});

	it('the seeds input commits to the store, clamped by the store, and the plan follows', async () => {
		render(LedgerDesignPanel);
		const seeds = page.getByTestId('ledger-seeds');
		await seeds.fill('99');
		seeds.element().dispatchEvent(new Event('change', { bubbles: true }));
		expect(ledger.seeds).toBe(LEDGER_SEED_LIMITS.max); // the STORE's clamp, reached the store
		await expect
			.element(page.getByTestId('ledger-plan'))
			.toHaveTextContent(
				`2 arms × ${LEDGER_SEED_LIMITS.max} seeds = ${LEDGER_SEED_LIMITS.max * 2} runs`
			);
	});

	it('a library row refills the composer with that finding’s template and slots', async () => {
		render(LedgerDesignPanel);
		expect(ledger.template.id).not.toBe('cliff'); // the state we claim to change starts elsewhere
		await page.getByRole('button', { name: /Above 1.0× cruise/ }).click();
		expect(ledger.template.id).toBe('cliff');
		expect(ledger.values).toEqual({ s: '1.0' });
	});
});
