import { expect, test, type Page } from '@playwright/test';
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
	await page.evaluate(() =>
		Promise.all(
			document
				.getAnimations()
				.filter((a) => (a.effect?.getTiming().iterations ?? 1) !== Infinity)
				.map((a) => a.finished.catch(() => {}))
		)
	);
	const results = await new AxeBuilder({ page }).analyze();
	// One line per violation, so a failure names the rule and the damage without spelunking.
	return results.violations.map((v) => `${v.impact}: ${v.id} (${v.nodes.length} node(s))`);
};

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	// appear THEN go — toBeHidden alone also passes before hydration renders the pill at all
	await expect(page.getByTestId('turbo')).toBeVisible({ timeout: 30_000 });
	await expect(page.getByTestId('turbo')).toBeHidden({ timeout: 90_000 });
});

test('the bench scans clean', async ({ page }) => {
	expect(await violations(page)).toEqual([]);
});

test('the bench scans clean in dark, too — contrast is per-palette, not per-layout', async ({
	page
}) => {
	await page.getByRole('button', { name: 'switch theme' }).click();
	// Let the colour TRANSITIONS land before measuring: axe reads computed colours, and a scan
	// mid-flight fails on blends that exist for a fifth of a second and belong to neither theme.
	await expect
		.poll(async () => {
			const a = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
			await page.waitForTimeout(120);
			const b = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
			return a === b;
		})
		.toBe(true);
	expect(await violations(page)).toEqual([]);
});

test('the conditions dialog scans clean', async ({ page }) => {
	await page.getByRole('button', { name: 'Conditions' }).first().click();
	await expect(page.getByRole('dialog', { name: /conditions/i })).toBeVisible();
	expect(await violations(page)).toEqual([]);
});

test('the inspector scans clean', async ({ page }) => {
	await page.getByRole('button', { name: '★ Champion' }).first().click();
	await expect(page.getByRole('dialog', { name: /fish mind/i })).toBeVisible();
	expect(await violations(page)).toEqual([]);
});

test('lab settings scans clean', async ({ page }) => {
	await page.getByRole('button', { name: 'lab settings' }).click();
	await expect(page.getByText('Deploy at')).toBeVisible();
	expect(await violations(page)).toEqual([]);
});

test('story mode scans clean', async ({ page }) => {
	await page.getByRole('button', { name: 'Play story' }).click();
	await expect(page.getByRole('dialog', { name: 'story mode' })).toBeVisible();
	expect(await violations(page)).toEqual([]);
});
