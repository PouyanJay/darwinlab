import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openResearch, runMinimalSweep } from './helpers';
import AxeBuilder from '@axe-core/playwright';

/**
 * The Report end to end (RC3): with a Sweep finding recorded, it renders the questions the Sweep
 * answers (Q2, Q6) with a real graph and the method footer (Q7), and every OTHER question as an honest
 * "run the test" prompt — never a fabricated verdict. And the brief survives a reload, since it is
 * assembled from the persisted notebook.
 *
 * The Sweep's numbers are a live measurement and are not asserted; what is asserted is the STRUCTURE of
 * the brief — which questions are answered, which are prompts, and that it stays axe-clean.
 */

async function reportWithASweep(page: Page): Promise<void> {
	await gotoApp(page);
	await openResearch(page);
	await runMinimalSweep(page);
	await page.getByTestId('add-to-report').click();
	await page.getByRole('tab', { name: 'The Report' }).click();
	await page.getByTestId('report').waitFor();
}

test('the Report answers what the Sweep settled and prompts for the rest', async ({ page }) => {
	await reportWithASweep(page);

	// The Sweep answers Q2 (what moves survival): a real section with its effect bars, NOT a prompt.
	const q2 = page.getByTestId('report-qQ2');
	await expect(q2).toBeVisible();
	await expect(q2).toContainText('← The Sweep'); // traced to its source
	await expect(q2.locator('.effects')).toBeVisible(); // the graph is drawn, not a placeholder
	await expect(q2).not.toContainText('Not answered yet');

	// The questions the Sweep does NOT answer show an honest prompt naming the test that would.
	await expect(page.getByTestId('report-qQ3')).toContainText('run The Ledger');
	await expect(page.getByTestId('report-qQ4')).toContainText('run The Atlas');
	await expect(page.getByTestId('report-qQ1')).toContainText('run a behaviour trace');

	// Q7 always states the method that reproduces it — the config fingerprint + seeds.
	await expect(page.getByTestId('report-qQ7')).toContainText('config');

	// The glance table lays out all seven, with the unanswered ones honestly "Not tested".
	await expect(page.getByTestId('report')).toContainText('Not tested');
});

test('the Report is assembled from the persisted notebook — it survives a reload', async ({
	page
}) => {
	await reportWithASweep(page);
	await expect(page.getByTestId('report-qQ2').locator('.effects')).toBeVisible();

	await page.reload();
	await expect(page.getByTestId('intro')).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('intro')).toBeHidden();
	await page.getByRole('tab', { name: 'The Report' }).click();

	// The Sweep's answer is still here — the report re-assembled from the notebook on disk.
	await expect(page.getByTestId('report-qQ2').locator('.effects')).toBeVisible();
});

test('the Report scans clean — the headings, the glance table and the graphs are new surface', async ({
	page
}) => {
	await reportWithASweep(page);
	await page.waitForTimeout(500); // let the fade-in land before axe reads computed colours

	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations.map((v) => `${v.impact}: ${v.id}`)).toEqual([]);
});
