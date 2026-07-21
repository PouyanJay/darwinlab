import { expect, test, type Page } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * The Atlas instrument, end to end: that a real landscape runs through the worker pool in the built
 * app and paints a survival map, and that drilling a cell and choosing "Watch this world" carries
 * that exact config back into Studio — the Research→Studio round-trip.
 *
 * The run is shrunk to the smallest real grid (3×3 at two seeds) so it is a handful of worker jobs,
 * not a full landscape. The survival VALUES are a live measurement and are not asserted; what is
 * asserted is that the pipeline produced a painted map, a legend, a drill-in, and the hand-off.
 */

async function openAtlas(page: Page): Promise<void> {
	await gotoApp(page);
	await page
		.getByRole('radiogroup', { name: 'lab mode' })
		.getByRole('radio', { name: 'Research' })
		.click();
	await page.getByRole('tab', { name: 'The Atlas' }).click();
	await page.getByTestId('atlas').waitFor();
}

/** Shrink the grid and seeds to the smallest real run, making the change events the store listens for fire. */
async function shrinkRun(page: Page): Promise<void> {
	const grid = page.locator('[data-testid="atlas"] .num input').first();
	const seeds = page.locator('[data-testid="atlas"] .num input').nth(1);
	await grid.fill('3');
	await grid.blur();
	await seeds.fill('2');
	await seeds.blur();
	await expect(page.getByTestId('atlas-summary')).toContainText('9 cells × 2 seeds');
}

test('a landscape runs, paints a map with a legend, and drills a cell', async ({ page }) => {
	test.setTimeout(120_000);
	await openAtlas(page);
	await shrinkRun(page);

	await page.getByRole('button', { name: 'Run landscape' }).click();

	// The map paints when the field lands, and the legend reads its measured range.
	await expect(page.locator('[data-testid="atlas"] canvas')).toBeVisible({ timeout: 90_000 });
	await expect(page.getByTestId('atlas')).toContainText('coral = shorter');

	// Drill a cell with the keyboard (deterministic, unlike clicking a pixel): move the cursor, open it.
	await page.locator('[data-testid="atlas"] canvas').focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('atlas-drill')).toBeVisible();
	await expect(page.getByTestId('atlas-drill')).toContainText('Predator speed');
});

test('"Watch this world" carries the drilled config back into Studio', async ({ page }) => {
	test.setTimeout(120_000);
	await openAtlas(page);
	await shrinkRun(page);

	await page.getByRole('button', { name: 'Run landscape' }).click();
	await expect(page.locator('[data-testid="atlas"] canvas')).toBeVisible({ timeout: 90_000 });

	await page.locator('[data-testid="atlas"] canvas').focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('atlas-drill')).toBeVisible();

	await page.getByRole('button', { name: 'Watch this world' }).click();

	// Back in Studio: the mode flipped and the Research stage is gone (asserted by the mode, not a
	// toBeHidden that would pass before the swap even rendered).
	await expect(
		page.getByRole('radiogroup', { name: 'lab mode' }).getByRole('radio', { name: 'Studio' })
	).toBeChecked();
	await expect(page.getByTestId('research-stage')).toHaveCount(0);
});
