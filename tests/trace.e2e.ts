import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openResearch } from './helpers';

/**
 * The Trace instrument end to end (RC5): the console's second discovery type. Running it evolves one
 * population and traces it against a random-brain control, then "add to report" fills the two questions
 * a trace settles — Q1 (did it learn?) with the learning curve and Q5 (how?) with the mechanism bars —
 * where before they were honest prompts. The evolved-vs-control contrast is the point, so the trace view
 * shows both schools.
 *
 * The numbers are a live measurement and are not asserted; what is asserted is the STRUCTURE — that a
 * run fills the graphs, and that its findings answer exactly Q1 and Q5 in the Report.
 */

async function runATrace(page: Page): Promise<void> {
	await gotoApp(page);
	await openResearch(page);
	await page.getByRole('tab', { name: 'The Trace' }).click();
	await page.getByTestId('trace').waitFor();
	await page.getByTestId('run-trace').click();
	// The evolve loop is a few seconds; wait for the study's summary to land (it appears only on a result).
	await expect(page.getByTestId('research-sidebar')).toContainText('Learned to', {
		timeout: 60_000
	});
}

test('a trace runs, draws its curve and mechanism, and shows the evolved-vs-control paths', async ({
	page
}) => {
	await runATrace(page);

	const trace = page.getByTestId('trace');
	// Q1: the learning curve block is drawn.
	await expect(trace.getByText('Did it learn?')).toBeVisible();
	// Q5: the mechanism bars name the two populations, and the trajectories show both schools' paths.
	// (Each label appears in a visible panel and again in the collapsed data-table, so scope to the first.)
	await expect(trace.getByText('evolved', { exact: true }).first()).toBeVisible();
	await expect(trace.getByText('Random control').first()).toBeVisible();
});

test('a trace answers Q1 and Q5 in the Report — and nothing else', async ({ page }) => {
	await runATrace(page);

	await page.getByTestId('add-to-report').click();
	await page.getByRole('tab', { name: 'The Report' }).click();
	await page.getByTestId('report').waitFor();

	// Q1 (did it learn) and Q5 (mechanism) are now answered by the trace — no longer prompts.
	const q1 = page.getByTestId('report-qQ1');
	await expect(q1).toContainText('← Behaviour trace');
	await expect(q1).not.toContainText('Not answered yet');

	const q5 = page.getByTestId('report-qQ5');
	await expect(q5).toContainText('← Behaviour trace');
	await expect(q5).not.toContainText('Not answered yet');

	// A trace does NOT answer the Sweep's or Ledger's questions — those stay honest prompts.
	await expect(page.getByTestId('report-qQ2')).toContainText('run The Sweep');
	await expect(page.getByTestId('report-qQ3')).toContainText('run The Ledger');
});
