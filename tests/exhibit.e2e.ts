import { expect, test, type Page, type Locator } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

/**
 * Champion clones, in the real app.
 *
 * The store's spec proves the freeze at the tick level. What is left for the browser is the part a
 * USER could be misled by: that the tank really swaps to the clones, and that the card says so while
 * it does — a tank of identical fish that is NOT the population being scored is the single most
 * misreadable thing this product can put on screen, so it must never be silent about it.
 */

const tile = (page: Page, index: number) => page.locator('section[aria-label^="world"]').nth(index);

/** The clones selector on a card. Scoped to its group: "Off" is a name several controls share. */
const clones = (card: Locator, label: 'Off' | 'Frozen' | 'Live') =>
	card.getByRole('radiogroup', { name: 'champion clones' }).getByRole('radio', { name: label });

test.beforeEach(async ({ page }) => {
	await gotoApp(page);
	await waitForPrewarm(page);
});

test('a frozen exhibit takes over the tank, and the card says what it is', async ({ page }) => {
	const card = tile(page, 2); // Direction — prewarmed, so it has a brain worth showing
	const line = card.getByTestId('exhibit-line');

	// Every mode carries one line, so switching does not change the panel's shape — only its words.
	await expect(line).toContainText('as it evolved'); // Off, to start

	await clones(card, 'Frozen').click();
	await expect(line).toContainText('The run is held');
	await expect(line).toContainText('best brain of the last generation');

	await clones(card, 'Off').click();
	await expect(line).toContainText('as it evolved'); // back to the population, no exhibit chip
});
