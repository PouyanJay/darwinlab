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

	// The conclusion lands: exactly one effect row (Direction — the only factor left in the grid), with
	// a seconds value. One row, asserted — a second unwanted row would fail loudly, not slip past.
	const effects = page.locator('[data-testid="sweep"] .effects');
	await expect(effects.locator('.row')).toHaveCount(1);
	await expect(effects.locator('.row')).toHaveText(/Direction/);
	await expect(effects.locator('.val')).toHaveText(/[−+]?\d/);

	// The run grid is a canvas now (no per-cell DOM), so assert its fixed shape structurally: 2
	// conditions × 2 seeds. A real count is safe here — the grid shape is fixed, not a live population.
	const heat = page.getByTestId('sweep-heat');
	await expect(heat).toHaveAttribute('data-conds', '2');
	await expect(heat).toHaveAttribute('data-seeds', '2');

	// …and the canvas actually PAINTED — the attributes above only report the intended shape, so sample
	// the pixels and prove they aren't one flat colour (cells were filled, not an empty early-return).
	const painted = await page
		.locator('[data-testid="sweep-heat"] canvas')
		.evaluate((canvas: HTMLCanvasElement) => {
			const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
			const first = `${data[0]},${data[1]},${data[2]},${data[3]}`;
			for (let i = 4; i < data.length; i += 4) {
				if (`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}` !== first) return true;
			}
			return false;
		});
	expect(painted).toBe(true);

	// The redesigned toolbar, the two result cards and the canvas heatmap are all new surface — the
	// painted Sweep must scan axe-clean (the canvas is a role=img graphic with a text label).
	expect(await scanForViolations(page)).toEqual([]);
});

test('hovering the run grid reads out the cell under the pointer', async ({ page }) => {
	await openSweep(page);
	await runMinimalSweep(page);

	// Hover the top of the grid → the first seed row; the bottom → the last. This exercises the picking
	// math (a chart-relative point back to a condition/seed) and pins that the canvas box and the box
	// `cellAt` measures are the same space — a padding mismatch between them would read the wrong row.
	const canvas = page.locator('[data-testid="sweep-heat"] canvas');
	const box = (await canvas.boundingBox())!;

	await canvas.hover({ position: { x: 12, y: 8 } });
	await expect(page.locator('.tip-cond')).toBeVisible();
	await expect(page.locator('.tip-val')).toContainText('seed 1');

	await canvas.hover({ position: { x: 12, y: box.height - 8 } });
	await expect(page.locator('.tip-val')).toContainText('seed 2'); // 2 seeds → the bottom row is seed 2
});

test('the summary warns when the grid would overflow the cap', async ({ page }) => {
	await openSweep(page);

	// Add every remaining factor; the full factorial (2·2·2·2·3·2·2 = 192) is far over the 32 cap.
	for (const factor of ['Closing', 'Persistence', 'Prey']) {
		await page.getByRole('button', { name: factor, exact: false }).first().click();
	}
	await expect(page.getByTestId('sweep-summary')).toContainText('capped');
});
