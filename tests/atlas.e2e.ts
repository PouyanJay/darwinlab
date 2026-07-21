import { expect, test } from '@playwright/test';
import { gotoApp, openAtlas, shrinkAtlasRun } from './helpers';

/**
 * The Atlas instrument, end to end: that a real landscape runs through the worker pool in the built
 * app and paints a survival map, and that drilling a cell and choosing "Watch this world" carries
 * that exact config back into Studio — the Research→Studio round-trip.
 *
 * The run is shrunk to the smallest real grid (3×3 at two seeds) so it is a handful of worker jobs,
 * not a full landscape. The survival VALUES are a live measurement and are not asserted; what is
 * asserted is that the pipeline produced a painted map, a legend, a drill-in, and the hand-off.
 */

test('a landscape runs, paints a map with a legend, and drills a cell', async ({ page }) => {
	test.setTimeout(120_000);
	await gotoApp(page);
	await openAtlas(page);
	await shrinkAtlasRun(page);

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
	await gotoApp(page);
	await openAtlas(page);
	await shrinkAtlasRun(page);

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

test('changing an axis after drilling does not relabel the measured cell', async ({ page }) => {
	// The blocking bug this guards: the drill card once read the LIVE picker axis, so switching the X
	// dropdown after a run relabelled the already-measured cell (e.g. "Vision 0.90×"). The card must
	// stay pinned to the axis the cell was actually measured on.
	test.setTimeout(120_000);
	await gotoApp(page);
	await openAtlas(page);
	await shrinkAtlasRun(page); // X = Predator speed, Y = Mutation (the defaults)

	await page.getByRole('button', { name: 'Run landscape' }).click();
	await expect(page.locator('[data-testid="atlas"] canvas')).toBeVisible({ timeout: 90_000 });

	await page.locator('[data-testid="atlas"] canvas').focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('atlas-drill')).toContainText('Predator speed'); // measured on this axis

	// The pickers are NOT disabled once a field exists, so this change really happens — and must not
	// relabel the frozen cell.
	await page.getByLabel('horizontal axis').selectOption({ label: 'Vision' });
	await expect(page.getByLabel('horizontal axis')).toHaveValue('vision'); // the picker moved
	await expect(page.getByTestId('atlas-drill')).toContainText('Predator speed'); // the card did NOT
	await expect(page.getByTestId('atlas-drill')).not.toContainText('Vision');
});
