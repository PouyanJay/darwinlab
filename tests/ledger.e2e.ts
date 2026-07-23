import { expect, test, type Page } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * The Ledger, end to end: that COMPOSING a claim (template + slots), running it, produces a verdict
 * card and a dated record in the built app — and, the whole point of the Ledger, that the record
 * SURVIVES A RELOAD and can be loaded back into the composer from its drill card.
 *
 * The verdict's value (supported/refuted) is a live measurement and is not asserted; what is
 * asserted is that a verdict was produced and persisted. Each Playwright test gets a fresh context,
 * so localStorage starts empty.
 */

async function openLedger(page: Page): Promise<void> {
	await page
		.getByRole('radiogroup', { name: 'lab mode' })
		.getByRole('radio', { name: 'Research' })
		.click();
	await page.getByRole('tab', { name: 'The Ledger' }).click();
	await page.getByTestId('ledger').waitFor();
}

test('a composed claim runs to a verdict, and the record survives a reload', async ({ page }) => {
	await gotoApp(page);
	await openLedger(page);

	// Compose: pick the Rivalry family — the preview recomposes to its default sentence.
	await page.getByRole('radio', { name: /Rivalry/ }).click();
	await expect(page.getByTestId('ledger-claim-preview')).toHaveText(
		'Direction pays more than distance.'
	);

	// The budget knob is real: drop to the minimum seeds so the live measurement stays quick.
	await page.getByTestId('ledger-seeds').fill('4');
	await page.getByTestId('ledger-plan').click(); // blur commits the change event
	await expect(page.getByTestId('ledger-plan')).toContainText('2 arms × 4 seeds = 8 runs');

	// Fire from the commit bar. The plot appears when the verdict lands.
	await page.getByTestId('ledger-run').click();
	await expect(page.getByTestId('verdict-plot')).toBeVisible({ timeout: 90_000 });
	await expect(page.getByTestId('record-feed')).toContainText('Direction pays more than distance');

	// The fresh verdict opens in the drill sidebar, and feeds the report notebook from there.
	await expect(page.getByTestId('ledger-drill')).toContainText('Direction pays more than distance');
	await page.getByTestId('add-to-report').click();
	await expect(page.getByTestId('findings')).toContainText('1 kept');

	// Reload and re-enter. The mode persists (Research), so we only re-open the Ledger tab — and the
	// record is still on disk.
	await page.reload();
	await expect(page.getByTestId('intro')).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('intro')).toBeHidden();
	await page.getByRole('tab', { name: 'The Ledger' }).click();

	await expect(page.getByTestId('record-feed')).toContainText('Direction pays more than distance');

	// The record's drill card can hand the claim back to the composer — the round trip that makes
	// an old verdict re-testable in one gesture.
	await page.getByRole('option', { name: /Direction pays more than distance/ }).click();
	await page.getByTestId('drill-load-composer').click();
	await expect(page.getByTestId('ledger-claim-preview')).toHaveText(
		'Direction pays more than distance.'
	);
});
