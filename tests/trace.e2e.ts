import { expect, test, type Page } from '@playwright/test';
import { gotoApp, runMinimalSweep, scanForViolations } from './helpers';

/**
 * The microscope end to end — the behaviour trace, folded into the Sweep's drill card (the
 * trace-in-drill mock is the contract; the standalone Trace instrument is gone). Drilling a measured
 * cell offers "Trace this world"; running it re-evolves that exact recipe at the run's own frozen
 * budget, keeps the brains, and pits the evolved school against a random-brain control on one frozen
 * bout. The numbers are a live measurement and are not asserted; what is asserted is the STRUCTURE —
 * the drill fills with the study, the traced curve lands on the cell's sparkline, the sidebar
 * actually scrolls rather than clipping (the fixed-height flex column trap the design mock sprang),
 * and "send trace" answers exactly Q1 + Q5 in the Report.
 */

async function openSweep(page: Page): Promise<void> {
	await gotoApp(page);
	await page
		.getByRole('radiogroup', { name: 'lab mode' })
		.getByRole('radio', { name: 'Research' })
		.click();
	await page.getByTestId('sweep').waitFor();
}

/** Shrink training to the 5-generation floor and PROVE it applied — the microscope re-evolves at the
 *  run's own budget, so this is also what keeps the traced evolve quick on a starved CI worker. */
async function runTinySweep(page: Page): Promise<void> {
	const gens = page.getByLabel(/Generations per run/);
	await gens.fill('5');
	await gens.blur();
	await expect(gens).toHaveValue('5');
	await runMinimalSweep(page);
	await expect(page.getByTestId('sweep-tiles')).toContainText('5 ×'); // the receipt froze the shrink
}

/** Drill one run of the grid — condition by horizontal position (the minimal sweep has two). */
async function drillCell(page: Page, conditionAt: number): Promise<void> {
	const canvas = page.locator('[data-testid="sweep-heat"] canvas');
	const box = (await canvas.boundingBox())!;
	await canvas.click({ position: { x: box.width * conditionAt, y: box.height * 0.25 } });
	await expect(page.getByTestId('sweep-drill')).toBeVisible();
}

async function traceDrilledCell(page: Page): Promise<void> {
	// A real evolve runs time-sliced on the main thread; give a starved CI worker real headroom.
	await page.getByTestId('drill-trace').click();
	await expect(page.getByTestId('drill-microscope')).toContainText('outlive the bout', {
		timeout: 60_000
	});
}

test('the microscope traces a drilled cell: study, overlay, scroll — and resets per recipe', async ({
	page
}) => {
	test.setTimeout(120_000);
	await openSweep(page);
	await runTinySweep(page);
	await drillCell(page, 0.25);

	// The idle door: the section wears the questions a trace settles and prices the run.
	const microscope = page.getByTestId('drill-microscope');
	await expect(microscope).toContainText('The microscope');
	await expect(microscope).toContainText('Q1');
	await expect(microscope).toContainText('Q5');
	await expect(page.getByTestId('drill-trace')).toContainText(/≈ \d+ s/);

	await traceDrilledCell(page);

	// The study fills the drill: both schools' headline, the paths panels, the mechanism bars.
	await expect(microscope).toContainText('random-brain control');
	await expect(microscope).toContainText('Evolved');
	await expect(microscope).toContainText('Random control');
	await expect(microscope.getByText('evolved', { exact: true }).first()).toBeVisible();

	// The traced school's curve lands ON the cell's sparkline — dashed gold beside the teal mean,
	// with the legend that keeps the two measurements labeled, never averaged.
	await expect(page.getByTestId('drill-traced-curve')).toBeVisible();
	await expect(page.getByTestId('sweep-drill')).toContainText('the traced school');

	// The sidebar SCROLLS to hold all of it — the mock's drill card silently clipped its microscope
	// when the fixed-height flex column compressed it; the real console must never repeat that.
	const scrollable = await page
		.getByTestId('research-sidebar')
		.evaluate((el) => el.scrollHeight > el.clientHeight);
	expect(scrollable).toBe(true);

	// The populated microscope is new drill surface — it must scan clean.
	expect(await scanForViolations(page)).toEqual([]);

	// Per-recipe reset: drilling the OTHER condition puts the door back — a different recipe must
	// never wear this study's results.
	await drillCell(page, 0.75);
	await expect(page.getByTestId('drill-trace')).toBeVisible();
	await expect(microscope).not.toContainText('outlive the bout');

	// …and re-drilling the traced condition finds its study again without re-running: the trace is
	// keyed to the recipe, not the click.
	await drillCell(page, 0.25);
	await expect(microscope).toContainText('outlive the bout');
});

test('sending the trace answers Q1 and Q5 in the Report — and nothing else', async ({ page }) => {
	test.setTimeout(120_000);
	await openSweep(page);
	await runTinySweep(page);
	await drillCell(page, 0.25);
	await traceDrilledCell(page);

	await page.getByTestId('drill-trace-report').click();
	await page.getByRole('tab', { name: 'The Report' }).click();
	await page.getByTestId('report').waitFor();

	// Q1 (did it learn) and Q5 (mechanism) are now answered by the trace — no longer prompts.
	const q1 = page.getByTestId('report-qQ1');
	await expect(q1).toContainText('← Behaviour trace');
	await expect(q1).not.toContainText('Not answered yet');

	const q5 = page.getByTestId('report-qQ5');
	await expect(q5).toContainText('← Behaviour trace');
	await expect(q5).not.toContainText('Not answered yet');

	// The trace does NOT answer the Ledger's question — that stays an honest prompt. (Q2/Q6 belong
	// to the sweep's own findings, which this test deliberately never sent.)
	await expect(page.getByTestId('report-qQ3')).toContainText('run The Ledger');
	await expect(page.getByTestId('report-qQ2')).toContainText('run The Sweep');
});
