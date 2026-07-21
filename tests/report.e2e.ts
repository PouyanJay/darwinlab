import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openResearch, runMinimalSweep, scanForViolations } from './helpers';

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

	// Q6 keeps the negatives (the honesty rule) — the "what did not work" note renders through the
	// live sweep → notebook → evidence pipeline, in one of its honest states.
	await expect(page.getByTestId('report-qQ6')).toContainText('did not work');

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
	// scanForViolations settles the fade-in (capped) before reading computed colours — no blind wait.
	expect(await scanForViolations(page)).toEqual([]);
});

test('the workspace header tags each instrument with the questions it answers', async ({ page }) => {
	await gotoApp(page);
	await openResearch(page);

	// The Sweep leads: it settles what matters (Q2) and what did not (Q6).
	await expect(page.getByRole('group', { name: 'answers Q2, Q6' })).toBeVisible();

	// Switch instruments and the tag follows — the Ledger settles whether a winner is real (Q3).
	await page.getByRole('tab', { name: 'The Ledger' }).click();
	await expect(page.getByRole('group', { name: 'answers Q3' })).toBeVisible();
	await expect(page.getByRole('group', { name: 'answers Q2, Q6' })).toBeHidden();
});

test('the Report exports as a Markdown file the study can keep', async ({ page }) => {
	await reportWithASweep(page);

	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByTestId('export-md').click()
	]);
	expect(download.suggestedFilename()).toBe('darwin-lab-report.md');

	// The file is the brief itself, not an empty stub — its title and the Sweep's answered question are in it.
	const stream = await download.createReadStream();
	const text = await new Promise<string>((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c) => chunks.push(Buffer.from(c)));
		stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		stream.on('error', reject);
	});
	expect(text).toContain('# Research report —');
	expect(text).toContain('## Q2 · What actually moves survival?');
});

test('the Print action asks the browser to print — the "save as PDF" path', async ({ page }) => {
	await reportWithASweep(page);

	// Stub window.print BEFORE clicking: a real print dialog would hang the headless run, and the flag
	// proves the button reached print() rather than silently doing nothing.
	await page.evaluate(() => {
		(window as unknown as { __prints: number }).__prints = 0;
		window.print = () => {
			(window as unknown as { __prints: number }).__prints++;
		};
	});
	await page.getByTestId('print-report').click();
	expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);
});

test('"Watch in Studio" carries the report subject back into Studio', async ({ page }) => {
	await reportWithASweep(page);

	await page.getByTestId('watch-subject').click();

	// The lab flips to Studio: the research console is gone and the Studio transport is back.
	await expect(page.getByTestId('research-stage')).toBeHidden();
	await expect(
		page.getByRole('radiogroup', { name: 'lab mode' }).getByRole('radio', { name: 'Studio' })
	).toBeChecked();
});
