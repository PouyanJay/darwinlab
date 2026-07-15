import { expect, test, type Page } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

/**
 * The flee assay, in the real app.
 *
 * The engine spec pins what the assay MEASURES (and calibrates it: brains that cannot feel the shark
 * score chance, exactly). What is left for the browser is that pressing the button really stages the
 * question — that the tank becomes a trial, that the run underneath is held while it answers, and
 * that what comes back is a number with an n behind it rather than a vibe.
 */

const tile = (page: Page, index: number) => page.locator('section[aria-label^="world"]').nth(index);

test.beforeEach(async ({ page }) => {
	await gotoApp(page);
	await waitForPrewarm(page);
});

test('the assay stages the question, holds the run, and answers with an n', async ({ page }) => {
	const card = tile(page, 2); // Direction — prewarmed, so it has a brain worth questioning
	const gen = await card.getByTestId('gen').innerText();

	await card.getByRole('button', { name: 'Run assay' }).click();

	// It says what you are looking at: ONE brain, walking the bearings the population was measured on.
	const progress = card.getByText(/Watching the best brain/);
	await expect(progress).toBeVisible();
	await expect(card.getByText(/The run is held/)).toBeVisible();

	// The verdict is the POPULATION's, and it arrives with the number of decisions behind it — because
	// one brain answers ten bearings, and ten coin flips are not a measurement.
	const accuracy = card.getByTestId('turn-accuracy');
	await expect(accuracy).toBeVisible({ timeout: 60_000 });
	await expect(card.getByText(/brains, n=/)).toBeVisible();
	await expect(accuracy).toHaveText(/^\d+%$/);

	// Asking a question must never cost the experiment a generation.
	expect(await card.getByTestId('gen').innerText()).toBe(gen);
});

test('the assay can be stopped, and gives the tank back', async ({ page }) => {
	const card = tile(page, 2);

	await card.getByRole('button', { name: 'Run assay' }).click();
	await expect(card.getByText(/Watching the best brain/)).toBeVisible();

	await card.getByRole('button', { name: 'Stop' }).click();

	await expect(card.getByText(/Watching the best brain/)).toBeHidden();
	await expect(card.getByRole('button', { name: /Run assay|Run again/ })).toBeVisible();
});

test('a finished result can be cleared, collapsing the panel back to its button', async ({
	page
}) => {
	const card = tile(page, 2);
	const verdict = card.getByTestId('turn-accuracy');

	await card.getByRole('button', { name: 'Run assay' }).click();
	await expect(verdict).toBeVisible({ timeout: 60_000 }); // the verdict lands immediately

	// Stop the champion's demonstration film first; the verdict stays on screen after it ends.
	await card.getByRole('button', { name: 'Stop' }).click();
	await expect(verdict).toBeVisible();

	await card.getByRole('button', { name: 'clear the assay result' }).click();

	// gone — the panel is just its button again, so a card does not carry a stale answer forever
	await expect(verdict).toBeHidden();
	await expect(card.getByRole('button', { name: 'Run assay' })).toBeVisible();
});
