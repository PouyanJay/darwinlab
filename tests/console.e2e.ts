import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * The Research console shell (RC0): the three zones exist, and the persistent right SIDEBAR adapts to
 * whichever instrument the rail has active — the drilled point for the Atlas, "This run" for the
 * Sweep, "This claim" for the Ledger. No existing spec guards that adaptation, so this one does.
 *
 * It asserts STRUCTURE, not measurements: nothing is run here, so every panel is in its empty state,
 * which is exactly the state whose copy must stay honest ("Not tested yet", "Run the Sweep …").
 */

async function openResearch(page: import('@playwright/test').Page): Promise<void> {
	await gotoApp(page);
	await page
		.getByRole('radiogroup', { name: 'lab mode' })
		.getByRole('radio', { name: 'Research' })
		.click();
	await page.getByTestId('research-rail').waitFor();
}

test('the console has three zones and the sidebar follows the active instrument', async ({
	page
}) => {
	await openResearch(page);

	const rail = page.getByTestId('research-rail');
	const sidebar = page.getByTestId('research-sidebar');

	// The rail leads with the subject world every instrument runs on.
	await expect(rail).toContainText('Generic world');

	// Default instrument is the Sweep: the workspace shows it, the sidebar shows its run context.
	await expect(page.getByTestId('sweep')).toBeVisible();
	await expect(sidebar).toContainText('This run');

	// The Ledger — the sidebar swaps to the active claim (untested, and it says so honestly).
	await page.getByRole('tab', { name: 'The Ledger' }).click();
	await expect(page.getByTestId('ledger')).toBeVisible();
	await expect(sidebar).toContainText('This claim');
	await expect(sidebar).toContainText('Not tested yet');

	// The Atlas — the sidebar becomes the drilled-point panel (empty until a cell is opened).
	await page.getByRole('tab', { name: 'The Atlas' }).click();
	await expect(page.getByTestId('atlas')).toBeVisible();
	await expect(sidebar).toContainText('Drilled point');

	// The Report is shown as a not-yet-built instrument, disabled — never a dead tab that opens nothing.
	await expect(page.getByRole('tab', { name: 'The Report' })).toBeDisabled();
});
