import { expect, test, type Page } from '@playwright/test';
import { gotoApp, waitForPrewarm, openAtlas, shrinkAtlasRun } from './helpers';
import AxeBuilder from '@axe-core/playwright';

/**
 * The Phase 9 a11y gate: axe scans of every major surface.
 *
 * The bar is ZERO violations, not a score — axe reports concrete failures with concrete nodes,
 * and the fix for a concrete failure is to fix it, not to average it away against the checks
 * that passed. (The plan's "≥95" was a Lighthouse framing; zero axe violations is stricter.)
 */

const violations = async (page: Page) => {
	// Let entrance animations LAND first: axe reads computed colours, and text caught mid fade-up
	// sits at partial opacity — a contrast failure that exists for a quarter of a second and
	// belongs to no real state. Infinite animations (status dots) are excluded or this never ends.
	//
	// The wait is CAPPED, because "wait for every finite animation to finish" is not safe on its own:
	// after a theme toggle a transition can be left in a state whose `.finished` never resolves (seen
	// hanging on CI), and one stuck promise would hang the whole scan. A theme transition is well under
	// a second, so 2s of settle is plenty, and the cap means a stuck animation can never wedge it.
	await page.evaluate(
		() =>
			Promise.race([
				Promise.all(
					document
						.getAnimations()
						.filter((a) => (a.effect?.getTiming().iterations ?? 1) !== Infinity)
						.map((a) => a.finished.catch(() => {}))
				),
				new Promise((resolve) => setTimeout(resolve, 2000))
			]) as Promise<unknown>
	);
	const results = await new AxeBuilder({ page }).analyze();
	// One line per violation, so a failure names the rule and the damage without spelunking.
	return results.violations.map((v) => `${v.impact}: ${v.id} (${v.nodes.length} node(s))`);
};

test.beforeEach(async ({ page }) => {
	// An axe scan of the whole bench is heavy now — the canvas plus every node's folded analysis
	// panels are a large DOM — and a CI runner is far slower than a dev machine. The default 30s was
	// enough locally but tipped over on CI for the theme-toggle scan; give these scans real headroom.
	test.setTimeout(60_000);
	await gotoApp(page);
	await waitForPrewarm(page);
});

test('the bench scans clean', async ({ page }) => {
	expect(await violations(page)).toEqual([]);
});

test('the intro scans clean', async ({ page }) => {
	// A fresh page, NOT gotoApp: that helper enters the lab, and the surface under test here is the
	// welcome screen itself, before anyone has touched anything.
	const fresh = await page.context().newPage();
	await fresh.goto('.');
	await expect(fresh.getByTestId('intro')).toBeVisible();
	expect(await violations(fresh)).toEqual([]);
	await fresh.close();
});

test('the bench scans clean in light, too — contrast is per-palette, not per-layout', async ({
	page
}) => {
	// Dark is the default (so "the bench scans clean" already covers it); switch to LIGHT and prove the
	// other palette holds contrast too. No settling wait of its own: the theme's colour TRANSITIONS
	// register in document.getAnimations(), so the settle inside violations() covers them — axe never
	// reads a blend that exists for a fifth of a second and belongs to neither theme.
	await page.getByRole('button', { name: /switch to (dark|light) theme/ }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	expect(await violations(page)).toEqual([]);
});

test('the conditions dialog scans clean', async ({ page }) => {
	await page.getByRole('button', { name: 'Conditions' }).first().click();
	await expect(page.getByRole('dialog', { name: /conditions/i })).toBeVisible();
	expect(await violations(page)).toEqual([]);
});

test('the inspector scans clean', async ({ page }) => {
	await page.getByRole('button', { name: 'Champion' }).first().click();
	await expect(page.getByRole('dialog', { name: /fish mind/i })).toBeVisible();
	expect(await violations(page)).toEqual([]);
});

test('lab settings scans clean', async ({ page }) => {
	await page.getByRole('button', { name: 'lab settings' }).click();
	// Scoped to the popover: the sidebar also has a "Deploy at gen" field, and an unscoped match hits both.
	await expect(page.locator('#lab-settings').getByText('Deploy at', { exact: true })).toBeVisible();
	expect(await violations(page)).toEqual([]);
});

test('story mode scans clean', async ({ page }) => {
	await page.getByRole('button', { name: 'Play story' }).click();
	await expect(page.getByRole('dialog', { name: 'story mode' })).toBeVisible();
	expect(await violations(page)).toEqual([]);
});

test('a schooling world scans clean — the school readout and shoal pills are new surface', async ({
	page
}) => {
	// turn schooling on for the first world, then close the dialog and scan the bench
	const dialog = page.getByRole('dialog', { name: /conditions/i });
	await page
		.locator('section[aria-label^="world"]')
		.first()
		.getByRole('button', { name: 'Conditions' })
		.click();
	await dialog.getByRole('radio', { name: 'Agents', exact: true }).click();
	await dialog.getByRole('checkbox', { name: /sense the shoal/i }).click();
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('school-nnd').first()).toBeVisible();
	expect(await violations(page)).toEqual([]);
});

test('the Research stage scans clean — the instrument tabs, the Sweep and the Ledger are new surface', async ({
	page
}) => {
	await page
		.getByRole('radiogroup', { name: 'lab mode' })
		.getByRole('radio', { name: 'Research' })
		.click();
	await page.getByTestId('sweep').waitFor();
	expect(await violations(page)).toEqual([]);

	// and the Ledger — its hypothesis list, verdict card and feed are their own new surface
	await page.getByRole('tab', { name: 'The Ledger' }).click();
	await page.getByTestId('ledger').waitFor();
	expect(await violations(page)).toEqual([]);

	// and the Atlas's controls — its axis pickers, grid/seed inputs and run button (empty state)
	await page.getByRole('tab', { name: 'The Atlas' }).click();
	await page.getByTestId('atlas').waitFor();
	expect(await violations(page)).toEqual([]);
});

test('the painted Atlas scans clean — the map, legend and drill card are new surface', async ({
	page
}) => {
	// A real landscape is measured here, so give it room; kept to the smallest grid (3×3, 2 seeds),
	// and shrinkAtlasRun PROVES that shrink applied before the run — otherwise a silent full-size grid
	// could hide behind this passing scan.
	test.setTimeout(120_000);
	await openAtlas(page);
	await shrinkAtlasRun(page);
	await page.getByRole('button', { name: 'Run landscape' }).click();
	await expect(page.locator('[data-testid="atlas"] canvas')).toBeVisible({ timeout: 90_000 });

	// Drill a cell so the drill card is in the scan too.
	await page.locator('[data-testid="atlas"] canvas').focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('atlas-drill')).toBeVisible();

	expect(await violations(page)).toEqual([]);
});
