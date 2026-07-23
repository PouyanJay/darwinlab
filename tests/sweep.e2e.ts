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

	// The honesty tiles lead: the receipts of the run that actually happened — cells vs planned,
	// seeds from the FROZEN receipt, and a wall clock. Values that vary (the clock) are not pinned.
	const tiles = page.getByTestId('sweep-tiles');
	await expect(tiles).toContainText('2 / 2'); // cells run of cells planned — fixed by the design
	await expect(tiles).toContainText('cells · full factorial');
	await expect(tiles).toContainText('2 seeds each');
	await expect(tiles).toContainText('wall clock');
	// The strongest tile has TWO honest outcomes on a live 2-seed measurement: Direction's interval
	// may or may not clear zero. Assert the tile speaks, not which verdict it reached.
	await expect(tiles).toContainText(/strongest effect · (direction|none cleared zero)/);

	// The science cards land beside the conclusion: the interactions card says honestly that one
	// factor has no pairs to test, and the convergence card draws the curves the run captured.
	await expect(page.getByTestId('sweep-interactions')).toContainText('two or more factors');
	await expect(page.getByTestId('sweep-convergence')).toBeVisible();
	await expect(page.getByTestId('sweep-convergence')).toContainText('learning curves');

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
	// painted Sweep must scan axe-clean (the drillable canvas is a role=application widget with a label).
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

test('drilling a cell opens its world below the grid, and watches it in Studio', async ({
	page
}) => {
	await openSweep(page);
	await runMinimalSweep(page);

	// Click a cell → the drilled-run card opens below the grid with that condition's world and numbers.
	const canvas = page.locator('[data-testid="sweep-heat"] canvas');
	const box = (await canvas.boundingBox())!;
	await canvas.click({ position: { x: box.width * 0.25, y: box.height * 0.25 } });

	const card = page.getByTestId('sweep-cell');
	await expect(card).toBeVisible();
	await expect(card).toContainText('This run'); // this seed's survival
	await expect(card).toContainText('Condition mean'); // the aggregate it sits within
	await expect(card).toContainText('Direction'); // the factor level that defines the condition
	await expect(card).toContainText('behavioural signature'); // the measured mechanism (how they survive)
	await expect(card).toContainText('Flee heading');
	await expect(card).toContainText(/ranks .* condition/); // where this world sits among the conditions
	await expect(card.locator('.dot.me').first()).toBeVisible(); // "you are here" ringed in a strip

	// "Watch this world" carries the condition into Studio — the round-trip out of the run grid.
	await card.getByRole('button', { name: 'Watch this world' }).click();
	await expect(page.getByTestId('research-stage')).toBeHidden();
	await expect(
		page.getByRole('radiogroup', { name: 'lab mode' }).getByRole('radio', { name: 'Studio' })
	).toBeChecked();
	// …and the world that landed is THIS condition, named for its factor — not just a mode flip. (The
	// minimal sweep varies only Direction, so the new Studio world is named "Direction off/on".)
	await expect(page.getByRole('textbox', { name: 'world name' }).last()).toHaveValue(/Direction/);
});

test('the run grid is keyboard-drillable — arrow to a cell, Enter opens it', async ({ page }) => {
	await openSweep(page);
	await runMinimalSweep(page);

	// The canvas is an application widget (it has a keyboard handler), so it takes focus and the arrows.
	await page.locator('[data-testid="sweep-heat"] canvas').focus();
	await page.keyboard.press('ArrowRight'); // move the cursor onto a cell
	await page.keyboard.press('Enter'); // …and drill it
	await expect(page.getByTestId('sweep-cell')).toBeVisible();

	// The drilled card + its mini-tank are new surface — scan clean.
	expect(await scanForViolations(page)).toEqual([]);

	// The close control dismisses it again.
	await page.getByRole('button', { name: 'close drilled run' }).click();
	await expect(page.getByTestId('sweep-cell')).toBeHidden();
});

test('the cap, switched on, warns that it will sample the grid', async ({ page }) => {
	await openSweep(page);

	// The default design is 48 cells and the cap is OFF (the full factorial is the honest default) —
	// switching it on at its default 32 must announce the sampling before anything runs.
	await expect(page.getByTestId('sweep-summary')).toContainText('48 cells');
	await expect(page.getByTestId('sweep-sampled-warn')).toHaveCount(0); // no warning before the cap
	await page.getByRole('switch', { name: 'cap the cell count' }).click();
	await expect(page.getByTestId('sweep-sampled-warn')).toContainText('random 32 of 48');
});
