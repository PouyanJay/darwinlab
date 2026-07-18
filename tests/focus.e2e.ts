import { expect, test, type Page } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

/**
 * The focus view — expand one world to fill the pane, the rest shrunk into the left rail.
 *
 * What a store test cannot reach: that the header's expand control really swaps the pannable canvas
 * for the master-detail layout, that the rail moves focus between worlds without leaving it, and that
 * a focused world which is removed drops the whole view back to the canvas rather than leaving a
 * detail pane pointed at a world that is no longer in the water.
 */

const focusView = (page: Page) => page.locator('.focus');
const detail = (page: Page) => page.locator('.workbench');
const tile = (page: Page, label: string) => page.locator(`section.tile[aria-label="${label}"]`);

test.beforeEach(async ({ page }) => {
	await gotoApp(page);
	await waitForPrewarm(page);
});

test('expanding a world opens the focus view; collapsing returns to the canvas', async ({
	page
}) => {
	await expect(focusView(page)).toHaveCount(0); // starts on the pannable canvas

	await tile(page, 'world 3: Direction').getByRole('button', { name: 'expand world' }).click();

	// The rail lists the WHOLE roster (five default worlds), and the detail is the one we expanded.
	await expect(focusView(page)).toBeVisible();
	await expect(page.getByRole('button', { name: /^focus world/ })).toHaveCount(5);
	await expect(detail(page)).toHaveAttribute('aria-label', 'world 3: Direction');

	// The champion's mind docks open in the workbench — the whole reason to expand a world.
	await expect(detail(page).getByRole('dialog', { name: 'Fish mind, live' })).toBeVisible();

	// The focused card's expand control has become a collapse — press it, and the canvas is back.
	await detail(page).getByRole('button', { name: 'collapse world' }).click();
	await expect(focusView(page)).toHaveCount(0);
	await expect(
		tile(page, 'world 3: Direction').getByRole('button', { name: 'expand world' })
	).toBeVisible();
});

test('the rail moves focus between worlds without leaving the view', async ({ page }) => {
	await tile(page, 'world 1: Blind drift').getByRole('button', { name: 'expand world' }).click();
	await expect(detail(page)).toHaveAttribute('aria-label', 'world 1: Blind drift');

	// A rail card is a jump straight to that world — no collapse in between.
	await page.getByRole('button', { name: 'focus world 4: Corner-wise' }).click();
	await expect(detail(page)).toHaveAttribute('aria-label', 'world 4: Corner-wise');
	await expect(focusView(page)).toBeVisible();
});

test('removing the focused world drops back to the canvas — the pane cannot outlive its world', async ({
	page
}) => {
	await tile(page, 'world 2: Distance').getByRole('button', { name: 'expand world' }).click();
	await expect(detail(page)).toHaveAttribute('aria-label', 'world 2: Distance');

	// Remove it from inside the focus view: the detail was pointed at THIS world, so the view has to go.
	await detail(page).getByRole('button', { name: 'remove world' }).click();

	await expect(focusView(page)).toHaveCount(0); // no detail pane pointed at a world that's gone…
	await expect(tile(page, 'world 2: Distance')).toHaveCount(0); // …and the world really did leave
});
