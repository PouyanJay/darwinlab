import { expect, test, type Page } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

/**
 * Schooling as a per-world config, in the real app.
 *
 * The engine specs prove schooling evolves and pays; the store specs prove the toggle rewires the
 * brain. What is left for the browser is the part a USER touches: that turning "Sense the shoal" on
 * in a world's Conditions gives that world the shoal-sense pills and the live school readout, and
 * that turning it off takes them away again — no separate exhibit, any world can school.
 */

const tile = (page: Page, i: number) => page.locator('section[aria-label^="world"]').nth(i);
const shoalToggle = (page: Page) =>
	page
		.getByRole('dialog', { name: /conditions/i })
		.getByRole('checkbox', { name: /sense the shoal/i });

async function openAgentsConditions(page: Page) {
	await tile(page, 0).getByRole('button', { name: 'Conditions' }).click();
	const dialog = page.getByRole('dialog', { name: /conditions/i });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('radio', { name: 'Agents', exact: true }).click();
}

test('a world schools when you toggle it on in Conditions, and stops when you toggle it off', async ({
	page
}) => {
	await gotoApp(page);
	await waitForPrewarm(page);

	// no world schools to start — no school readout anywhere
	await expect(page.getByTestId('school-nnd')).toHaveCount(0);

	await openAgentsConditions(page);
	await expect(shoalToggle(page)).not.toBeChecked();
	await shoalToggle(page).click(); // wire the shoal senses in
	await expect(shoalToggle(page)).toBeChecked();
	await page.keyboard.press('Escape'); // close the dialog

	// that one world now carries a live spacing readout; the others still do not. (Pills read "shoal"
	// in the DOM — uppercased only by CSS — so the readout is the robust check.)
	await expect(page.getByTestId('school-nnd')).toHaveCount(1); // only the world we turned on
	await expect(tile(page, 0).getByTestId('school-nnd')).toHaveText(/\d+px apart/); // a live number warms in

	// turn it back off — the schooling chrome goes with it
	await openAgentsConditions(page);
	await shoalToggle(page).click();
	await expect(shoalToggle(page)).not.toBeChecked();
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('school-nnd')).toHaveCount(0);
});
