import { expect, test } from '@playwright/test';
import { gotoApp, openResearch } from './helpers';

/**
 * The Findings notebook end to end (RC1): running an instrument and pressing "add to report" records
 * a finding that shows in the rail — and, the whole point of persistence, SURVIVES A RELOAD.
 *
 * The finding's TITLE is a live measurement (which factor led, or none) and is not asserted; what is
 * asserted is that a finding was kept, the button flipped to "in report", and the notebook reloaded.
 * The sweep is shrunk to one factor at two seeds so it is a few worker jobs, not a real measurement.
 */

test('a swept finding is added to the notebook, shows in the rail, and survives a reload', async ({
	page
}) => {
	await gotoApp(page);
	await openResearch(page); // opens on the Sweep

	// Shrink to a single factor (Direction), two seeds → two conditions, four jobs.
	for (const factor of ['Distance', 'Walls', 'Predator speed']) {
		await page.getByRole('button', { name: factor, exact: false }).first().click();
	}
	await page.locator('.seeds input').fill('2');
	await page.locator('.seeds input').blur();
	await expect(page.getByTestId('sweep-summary')).toContainText('2 conditions × 2 seeds');

	await page.getByRole('button', { name: 'Run sweep' }).click();
	await expect(page.locator('[data-testid="sweep"] .effects')).toBeVisible({ timeout: 60_000 });

	// The notebook starts empty; adding the run records exactly one finding and the button flips.
	const rail = page.getByTestId('findings');
	await expect(rail).not.toContainText('kept');
	const add = page.getByTestId('add-to-report');
	await expect(add).toContainText('Add to report');

	await add.click();
	await expect(add).toContainText('In report'); // the button now reads as done
	await expect(rail).toContainText('1 kept'); // and the finding is in the rail

	// Reload and re-enter. The mode persists (Research); the notebook is on disk, so the finding is
	// still in the rail — the reload is the assertion, not a fresh empty state that would pass anyway.
	await page.reload();
	await expect(page.getByTestId('intro')).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('intro')).toBeHidden();

	await expect(page.getByTestId('findings')).toContainText('1 kept');
});
