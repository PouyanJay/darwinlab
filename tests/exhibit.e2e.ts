import { expect, test, type Page, type Locator } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

/**
 * Champion clones, in the real app.
 *
 * The store's spec proves the freeze and the record at the tick level. What is left for the browser
 * is the part a USER could be misled by: that the tank really swaps to the clones, that the card says
 * so while it does, and that a bottleneck — the one control here that changes the run — announces
 * itself, asks first, and leaves a mark behind that does not go away.
 */

const tile = (page: Page, index: number) => page.locator('section[aria-label^="world"]').nth(index);

/** The clones selector on a card. Scoped to its group: "Off" is a name several controls share. */
const clones = (card: Locator, label: 'Off' | 'Frozen' | 'Live') =>
	card.getByRole('radiogroup', { name: 'champion clones' }).getByRole('radio', { name: label });

test.beforeEach(async ({ page }) => {
	await gotoApp(page);
	await waitForPrewarm(page);
});

test('a frozen exhibit takes over the tank, and says what it is', async ({ page }) => {
	const card = tile(page, 2); // Direction — prewarmed, so it has a brain worth showing

	await clones(card, 'Frozen').click();

	// A tank of identical fish that is NOT the population being scored is the single most misreadable
	// thing this product can put on screen. It is not allowed to be silent about it. (By test id, not
	// by role: the card carries a second live region — the deployment announcer in TileStats.)
	const banner = card.getByTestId('exhibit-banner');
	await expect(banner).toContainText('best brain of the last generation');
	await expect(banner).toContainText('The run is held');

	await clones(card, 'Off').click();
	await expect(banner).toBeHidden();
});

test('the bottleneck asks first, and can be refused', async ({ page }) => {
	const card = tile(page, 2);

	await card.getByRole('button', { name: 'clonal bottleneck' }).click();

	const warning = card.getByRole('alert');
	await expect(warning).toContainText('This changes the run');
	await expect(warning).toContainText('cannot be undone');

	await card.getByRole('button', { name: 'Cancel' }).click();
	await expect(warning).toBeHidden();
	await expect(card.getByText(/bottlenecked/)).toBeHidden(); // nothing happened, and nothing is claimed
});

test('a bottleneck leaves a mark on the run it changed — permanently', async ({ page }) => {
	const card = tile(page, 2);
	const gen = await card.getByTestId('gen').innerText();

	await card.getByRole('button', { name: 'clonal bottleneck' }).click();
	await card.getByRole('button', { name: 'Bottleneck the run' }).click();

	// An intervention that is not on the record is a lie by omission: the curve would show a cliff
	// with no cause. The mark names the generation it struck at, and it does not expire.
	const mark = card.getByText(/bottlenecked · gen/);
	await expect(mark).toBeVisible();
	await expect(card.getByText('every fish since descends from one individual')).toBeVisible();

	// …and the run carried on from there rather than restarting: same generation, still evolving.
	expect(await card.getByTestId('gen').innerText()).toBe(gen);
	await expect(mark).toBeVisible(); // still there several seconds and a generation later
});
