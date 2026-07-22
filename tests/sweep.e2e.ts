import { expect, test, type Page } from '@playwright/test';
import { gotoApp, runMinimalSweep, scanForViolations } from './helpers';

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
	await runMinimalSweep(page);

	// The conclusion lands: a Direction effect row with a seconds value, over a 2×2 run grid.
	const effects = page.locator('[data-testid="sweep"] .effects');
	await expect(effects.locator('.row').first()).toHaveText(/Direction/);
	await expect(effects.locator('.val').first()).toHaveText(/[−+]?\d/);
	// The run grid is a canvas now (no per-cell DOM), so assert its fixed shape structurally: 2
	// conditions × 2 seeds. A real count is safe here — the grid shape is fixed, not a live population.
	const heat = page.getByTestId('sweep-heat');
	await expect(heat).toHaveAttribute('data-conds', '2');
	await expect(heat).toHaveAttribute('data-seeds', '2');

	// The redesigned toolbar, the two result cards and the canvas heatmap are all new surface — the
	// painted Sweep must scan axe-clean (the canvas is a role=img graphic with a text label).
	expect(await scanForViolations(page)).toEqual([]);
});

test('the summary warns when the grid would overflow the cap', async ({ page }) => {
	await openSweep(page);

	// Add every remaining factor; the full factorial (2·2·2·2·3·2·2 = 192) is far over the 32 cap.
	for (const factor of ['Closing', 'Persistence', 'Prey']) {
		await page.getByRole('button', { name: factor, exact: false }).first().click();
	}
	await expect(page.getByTestId('sweep-summary')).toContainText('capped');
});
