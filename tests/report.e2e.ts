import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openResearch, runMinimalSweep, scanForViolations } from './helpers';

/**
 * The Report end to end: with a Sweep finding recorded, it assembles the seven-question brief — a
 * coverage spine, an auto-composed abstract, the questions the Sweep answers (Q2, Q6) with real
 * figures, the method (Q7), and every OTHER question as an honest "run the test" prompt, never a
 * fabricated verdict. The redesign adds reading modes, skeptic toggles and drill-through; those are
 * exercised here too. The brief survives a reload, since it is assembled from the persisted notebook.
 *
 * The Sweep's numbers are a live measurement and are not asserted; what is asserted is the STRUCTURE —
 * which questions are answered, which are prompts, that the interactions work, and that it stays clean.
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
	// Full is the default reading mode, so every section is expanded and the figure is on screen.
	const q2 = page.getByTestId('report-qQ2');
	await expect(q2).toBeVisible();
	await expect(q2).toContainText('← The Sweep'); // traced to its source
	await expect(q2.locator('.effects')).toBeVisible(); // the figure is drawn, not a placeholder
	await expect(q2).not.toContainText('Not answered yet');

	// The questions the Sweep does NOT answer show an honest prompt naming the test that would.
	await expect(page.getByTestId('report-qQ3')).toContainText('Run The Ledger');
	await expect(page.getByTestId('report-qQ4')).toContainText('Run The Atlas');
	await expect(page.getByTestId('report-qQ1')).toContainText('Run a behaviour trace');

	// Q7 always states the method that reproduces it — the config fingerprint + seeds.
	await expect(page.getByTestId('report-qQ7')).toContainText('config');

	// Q6 keeps the negatives (the honesty rule) — the "what did not work" panel renders through the
	// live sweep → notebook → evidence pipeline, in one of its honest states.
	await expect(page.getByTestId('report-qQ6')).toContainText('did not work');

	// The unanswered questions read honestly — an untested one says so, never a fabricated verdict.
	await expect(page.getByTestId('report-qQ3')).toContainText('Not answered yet');

	// The auto-abstract composed at least one cited clause from the real finding — and is flagged as
	// assembled, not authored.
	await expect(page.getByTestId('report-abstract')).toContainText('assembled from findings');
});

test('the reading modes and skeptic toggles interrogate the brief', async ({ page }) => {
	await reportWithASweep(page);
	const q2 = page.getByTestId('report-qQ2');
	const modes = page.getByRole('group', { name: 'reading mode' });

	// Full (default) shows the figure; Brief collapses every section to its one-line answer.
	await expect(q2.locator('.effects')).toBeVisible();
	await modes.getByRole('button', { name: 'Brief' }).click();
	await expect(q2.locator('.effects')).toBeHidden();

	// Full opens them back up.
	await modes.getByRole('button', { name: 'Full' }).click();
	await expect(q2.locator('.effects')).toBeVisible();

	// The 95%-interval skeptic toggle adds/removes the whiskers on the effect figure — a real layer,
	// on by default. Unchecking it removes them; the bars themselves stay.
	await expect(q2.locator('.whisk').first()).toBeVisible();
	await page.getByTestId('report-tog-intervals').uncheck();
	await expect(q2.locator('.whisk')).toHaveCount(0);
	await expect(q2.locator('.effects .bar').first()).toBeVisible();
});

test('a source drill-through carries the reader back to the instrument', async ({ page }) => {
	await reportWithASweep(page);

	// Clicking Q2's "← The Sweep" navigates the console to the Sweep — conclusion back to its evidence.
	await page
		.getByTestId('report-qQ2')
		.getByRole('button', { name: /The Sweep/ })
		.click();
	await expect(page.getByTestId('sweep')).toBeVisible();
	await expect(page.locator('#rtab-sweep')).toHaveAttribute('aria-selected', 'true');
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

test('the Report scans clean — the spine, abstract, sections and figures are new surface', async ({
	page
}) => {
	await reportWithASweep(page);
	// scanForViolations settles the fade-in (capped) before reading computed colours — no blind wait.
	expect(await scanForViolations(page)).toEqual([]);
});

test('the workspace header tags each instrument with the questions it answers', async ({
	page
}) => {
	await gotoApp(page);
	await openResearch(page);

	// The Sweep leads: its own questions (Q2 what matters, Q6 what did not) plus the microscope's
	// (Q1 did it learn, Q5 the mechanism) — the behaviour trace lives in its drill now.
	await expect(page.getByRole('group', { name: 'answers Q1, Q2, Q5, Q6' })).toBeVisible();

	// Switch instruments and the tag follows — the Ledger settles whether a winner is real (Q3).
	await page.getByRole('tab', { name: 'The Ledger' }).click();
	await expect(page.getByRole('group', { name: 'answers Q3' })).toBeVisible();
	await expect(page.getByRole('group', { name: 'answers Q1, Q2, Q5, Q6' })).toBeHidden();
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

test('the print stylesheet isolates the report — only the brief is on the page', async ({
	page
}) => {
	await reportWithASweep(page);

	// Emulate the print medium and read computed visibility: the "hide everything, reveal one region"
	// trick must actually hide the console chrome and show the report — the CSS itself under test, not
	// just the button that triggers it. (A wrong selector or lost specificity would silently blank the
	// wrong thing; the click test alone would never notice.)
	await page.emulateMedia({ media: 'print' });
	await expect(page.getByTestId('research-rail')).toHaveCSS('visibility', 'hidden');
	await expect(page.getByTestId('research-sidebar')).toHaveCSS('visibility', 'hidden');
	await expect(page.getByTestId('report')).toHaveCSS('visibility', 'visible');
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
