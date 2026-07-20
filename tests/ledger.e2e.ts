import { expect, test, type Page } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * The Ledger, end to end: that stating a claim and running it produces a verdict card and a dated
 * record in the built app — and, the whole point of the Ledger, that the record SURVIVES A RELOAD.
 *
 * The verdict's value (supported/refuted) is a live measurement and is not asserted; what is asserted
 * is that a verdict was produced and persisted. Each Playwright test gets a fresh context, so
 * localStorage starts empty.
 */

async function openLedger(page: Page): Promise<void> {
	await page
		.getByRole('radiogroup', { name: 'lab mode' })
		.getByRole('radio', { name: 'Research' })
		.click();
	await page.getByRole('tab', { name: 'The Ledger' }).click();
	await page.getByTestId('ledger').waitFor();
}

test('a claim runs to a verdict, and the record survives a reload', async ({ page }) => {
	await gotoApp(page);
	await openLedger(page);

	// Run the active claim (Direction pays more than distance). The plot appears when the verdict lands.
	await page.getByRole('button', { name: 'Run this test' }).click();
	await expect(page.getByTestId('verdict-plot')).toBeVisible({ timeout: 90_000 });
	await expect(page.getByTestId('discovery-feed')).toContainText(
		'Direction pays more than distance'
	);

	// Reload and re-enter. The mode persists (Research), so we only re-open the Ledger tab — and the
	// record is still on disk.
	await page.reload();
	await expect(page.getByTestId('intro')).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('intro')).toBeHidden();
	await page.getByRole('tab', { name: 'The Ledger' }).click();

	await expect(page.getByTestId('discovery-feed')).toContainText(
		'Direction pays more than distance'
	);
});
