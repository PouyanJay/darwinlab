import { expect, test, type Page } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

/**
 * The Phase 9 keyboard gate: the whole product is drivable without a pointer.
 *
 * The pointer-only path this phase closed was the tank itself — every fish was click-to-inspect.
 * These tests walk it by keys alone: Tab REACHES the tank (page.keyboard, never locator.press,
 * which focuses its target first and proves nothing about reachability), arrows walk the
 * creatures, and the walk KEEPS the focus — an inspector that stole it would end the walk after
 * one step.
 */

const inspector = (page: Page) => page.getByRole('dialog', { name: /fish mind/i });

/** Tab until focus lands on a tank widget — bounded, so a broken tab order fails loudly. */
async function tabToTank(page: Page) {
	const onTank = () =>
		page.evaluate(() => document.activeElement?.getAttribute('role') === 'application');
	for (let hops = 0; hops < 60; hops++) {
		if (await onTank()) return;
		await page.keyboard.press('Tab');
	}
	expect(await onTank(), 'no tank became focusable within 60 tab stops').toBe(true);
}

test.beforeEach(async ({ page }) => {
	await gotoApp(page);
	await waitForPrewarm(page);
});

test('Tab reaches the tank; arrows walk creatures; the walk keeps its focus; Esc puts down', async ({
	page
}) => {
	await tabToTank(page);

	await page.keyboard.press('ArrowRight');
	await expect(inspector(page)).toBeVisible();

	// the walk continues — the inspector did NOT steal the keyboard
	expect(await page.evaluate(() => document.activeElement?.getAttribute('role'))).toBe(
		'application'
	);
	await page.keyboard.press('ArrowRight');
	await expect(inspector(page)).toBeVisible(); // still open, now on the next creature

	await page.keyboard.press('Escape');
	await expect(inspector(page)).toBeHidden();
});

test('the ★ Champion path still moves focus into the drawer — a button click is not a walk', async ({
	page
}) => {
	await page.getByRole('button', { name: '★ Champion' }).first().click();
	await expect(inspector(page)).toBeVisible();
	// the drawer took focus (its close button is the first stop inside)
	expect(
		await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)
	).toBe(true);
});

test('arrows on a focused tank inside the FILM walk creatures — they must not also skip the scene', async ({
	page
}) => {
	await page.getByRole('button', { name: 'Play story' }).click();
	const story = page.getByRole('dialog', { name: 'story mode' });
	await expect(story).toBeVisible();
	await expect(story.getByText(/scene 1 of 5/i)).toBeVisible();

	await tabToTank(page);
	await page.keyboard.press('ArrowRight');

	await expect(inspector(page)).toBeVisible(); // the arrow walked a creature…
	await expect(story.getByText(/scene 1 of 5/i)).toBeVisible(); // …and the film did NOT jump
});

test('Esc in the inspector mid-film closes the inspector — not the film with it', async ({
	page
}) => {
	await page.getByRole('button', { name: 'Play story' }).click();
	const story = page.getByRole('dialog', { name: 'story mode' });
	await expect(story).toBeVisible();

	await tabToTank(page);
	await page.keyboard.press('ArrowRight');
	await expect(inspector(page)).toBeVisible();

	// with focus INSIDE the drawer, Esc belongs to the drawer — both it and the film listen on
	// window, and one press must not tear down both
	await inspector(page).getByRole('button', { name: 'close inspector' }).focus();
	await page.keyboard.press('Escape');
	await expect(inspector(page)).toBeHidden();
	await expect(story).toBeVisible(); // the film survived the press

	await page.keyboard.press('Escape');
	await expect(story).toBeHidden(); // the NEXT one leaves
});

test('the shortcuts are documented where a user will look: lab settings', async ({ page }) => {
	await page.getByRole('button', { name: 'lab settings' }).click();
	await expect(page.getByRole('heading', { name: 'Keyboard' })).toBeVisible();
	await expect(page.getByText('walk a focused tank')).toBeVisible();
});
