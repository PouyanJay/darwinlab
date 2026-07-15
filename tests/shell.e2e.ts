import { expect, test, type Page } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

/**
 * The control column, at desktop size — where it is DOCKED and resizable.
 *
 * `responsive.e2e.ts` covers the other layout (a phone, where the panel is an overlay). What is
 * proven here is the half a store test cannot reach: that the collapse really leaves the run
 * controls behind, that the divider really moves the panel, and that both survive a reload — the
 * claim "it is remembered" is worth nothing if it is only ever checked in the same page load that
 * made the choice.
 */

const rail = (page: Page) => page.getByRole('button', { name: 'expand the controls' });
const panel = (page: Page) => page.getByRole('button', { name: 'collapse the controls' });
const divider = (page: Page) => page.getByRole('separator', { name: 'sidebar width' });

/** The panel's real, rendered width — the thing a user actually sees change. */
const panelWidth = (page: Page) =>
	page.getByRole('complementary', { name: 'lab controls' }).evaluate((el) => el.clientWidth);

test.beforeEach(async ({ page }) => {
	await gotoApp(page);
	await waitForPrewarm(page);
});

test('collapsing leaves the run controls behind, not a hole', async ({ page }) => {
	await expect(page.getByRole('radio', { name: '1×' })).toBeVisible(); // the panel, in full

	await panel(page).click();

	// The rail is the whole point of the collapse: mid-experiment you are still pausing and
	// fast-forwarding, and a control you must re-open a panel to press is a control you stop using.
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	await expect(page.getByRole('button', { name: /Train/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /simulation speed/ })).toBeVisible();

	// …and it really is collapsed: the panel's own controls are gone, not merely narrower.
	await expect(page.getByRole('radio', { name: '1×' })).toBeHidden();
	await expect(page.getByTestId('run-manifest')).toBeHidden();

	await rail(page).click();
	await expect(page.getByRole('radio', { name: '1×' })).toBeVisible();
});

test('the rail still drives the sim: its Pause is the bench Pause', async ({ page }) => {
	await panel(page).click();

	await page.getByRole('button', { name: 'Pause' }).click();

	// The rail's transport is the same store, not a decoration that looks like one.
	await expect(page.getByRole('button', { name: 'Evolve' })).toBeVisible();
});

test('the divider widens the panel — and the width is still there after a reload', async ({
	page
}) => {
	const before = await panelWidth(page);

	await divider(page).focus();
	for (let press = 0; press < 4; press++) await page.keyboard.press('ArrowRight');

	const widened = await panelWidth(page);
	expect(widened).toBeGreaterThan(before); // it moved, and it moved the right way

	await gotoApp(page);
	await waitForPrewarm(page);

	expect(await panelWidth(page)).toBe(widened);
});

test('a collapse is remembered too — the bench opens the way you left it', async ({ page }) => {
	await panel(page).click();
	await expect(page.getByRole('radio', { name: '1×' })).toBeHidden();

	await gotoApp(page);
	await waitForPrewarm(page);

	// Still on the rail, and still the run controls — this is the state that was saved.
	await expect(rail(page)).toBeVisible();
	await expect(page.getByRole('radio', { name: '1×' })).toBeHidden();
	await expect(page.getByRole('button', { name: /Train/ })).toBeVisible();
});
