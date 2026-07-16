import { expect, test, type Page } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

/**
 * The Shoal exhibit, in the real app.
 *
 * The engine specs prove schooling evolves and the sweep proves it pays; the store specs prove the
 * switch clears state. What is left for the browser is the part a USER touches: that the switcher
 * really swaps the bench to Alone vs The Shoal, that only the schooling tanks carry a school readout,
 * and that switching back restores the sense ladder with no schooling chrome left behind.
 */

const worlds = (page: Page) => page.locator('section[aria-label^="world"]');
const exhibit = (page: Page, name: 'Sense ladder' | 'The Shoal') =>
	page.getByRole('radio', { name, exact: true });

test.beforeEach(async ({ page }) => {
	await gotoApp(page);
	await waitForPrewarm(page); // opens on the sense ladder
});

test('the switcher swaps the bench to Alone vs The Shoal and back', async ({ page }) => {
	// opens on the sense ladder — five worlds, none of them schooling
	await expect(worlds(page)).toHaveCount(5);
	await expect(page.getByTestId('school-nnd')).toHaveCount(0);

	await exhibit(page, 'The Shoal').click();
	await waitForPrewarm(page); // the Shoal prewarms further before its first paint

	const shown = worlds(page);
	await expect(shown).toHaveCount(2);
	// the name lives in an editable label (an input), so it is the aria-label, not text content
	await expect(shown.nth(0)).toHaveAttribute('aria-label', /Alone/);
	await expect(shown.nth(1)).toHaveAttribute('aria-label', /The Shoal/);

	// both schooling tanks carry the live spacing readout (the whole Alone-vs-Shoal comparison);
	// a schooling world declares the shoal senses whether they are ablated on or off
	const nnd = page.getByTestId('school-nnd');
	await expect(nnd).toHaveCount(2);
	await expect(nnd.first()).toContainText('px apart');

	// back to the ladder: five worlds again, and no schooling chrome survives the switch
	await exhibit(page, 'Sense ladder').click();
	await waitForPrewarm(page);
	await expect(worlds(page)).toHaveCount(5);
	await expect(page.getByTestId('school-nnd')).toHaveCount(0);
});
