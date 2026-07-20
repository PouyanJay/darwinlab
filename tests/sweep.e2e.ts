import { expect, test, type Page } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * The Sweep instrument, end to end: that a real sweep runs through the worker pool in the built app
 * and turns into an effect chart and a run grid, and that the grid-size summary warns honestly when
 * the factorial would overflow the cap.
 *
 * The run is shrunk to the bone — one factor (two conditions) at two seeds — so it is a few worker
 * jobs, not a real measurement. The effect's SIGN is not asserted (it is a live measurement); what is
 * asserted is that the pipeline produced a value and a grid at all.
 */

async function openSweep(page: Page): Promise<void> {
	await gotoApp(page);
	await page
		.getByRole('radiogroup', { name: 'lab mode' })
		.getByRole('radio', { name: 'Research' })
		.click();
	await page.getByTestId('sweep').waitFor();
}

test('a sweep runs and reports an effect with its run grid', async ({ page }) => {
	await openSweep(page);

	// Shrink to a single factor (Direction) and two seeds: two conditions, four jobs.
	for (const factor of ['Distance', 'Walls', 'Predator speed']) {
		await page.getByRole('button', { name: factor, exact: false }).first().click();
	}
	await page.locator('.seeds input').fill('2');
	await page.locator('.seeds input').blur();
	await expect(page.getByTestId('sweep-summary')).toContainText('2 conditions × 2 seeds');

	await page.getByRole('button', { name: 'Run sweep' }).click();

	// The conclusion lands: a Direction effect row with a seconds value, over a 2×2 run grid.
	const effects = page.locator('[data-testid="sweep"] .effects');
	await expect(effects).toBeVisible({ timeout: 60_000 });
	await expect(effects.locator('.row')).toHaveText(/Direction/);
	await expect(effects.locator('.val')).toHaveText(/[−+]?\d/);
	// The grid is a fixed shape (2 conditions × 2 seeds), not a live population — a real count is safe.
	await expect(page.locator('[data-testid="sweep"] .heat .cell')).toHaveCount(4);
});

test('the summary warns when the grid would overflow the cap', async ({ page }) => {
	await openSweep(page);

	// Add every remaining factor; the full factorial (2·2·2·2·3·2·2 = 192) is far over the 32 cap.
	for (const factor of ['Closing', 'Persistence', 'Prey']) {
		await page.getByRole('button', { name: factor, exact: false }).first().click();
	}
	await expect(page.getByTestId('sweep-summary')).toContainText('capped');
});
