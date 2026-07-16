import { expect, type Page, type Locator } from '@playwright/test';

/**
 * Open the bench. "." resolves against baseURL, so the same suite passes whether the app is
 * served at the origin root or under a GitHub Pages sub-path (BASE_PATH=/darwinlab). A
 * goto('/') would not: an absolute path resolves against the origin and escapes the base.
 */
export async function gotoApp(page: Page): Promise<void> {
	await page.goto('.');
}

/**
 * Wait for the load-time prewarm to APPEAR and then finish.
 *
 * `toBeHidden` alone is the prewarm trap: it also passes before hydration has rendered the
 * turbo pill at all, and the test then runs against a bench still at generation zero. It
 * shipped flaky twice under CPU contention before every suite waited for the pill both ways.
 */
export async function waitForPrewarm(page: Page): Promise<void> {
	await expect(page.getByTestId('turbo')).toBeVisible({ timeout: 30_000 });
	await expect(page.getByTestId('turbo')).toBeHidden({ timeout: 90_000 });
}

/**
 * Open a node's "Analysis & assays" disclosure — where the assay, evaluation and ablation matrix now
 * live, folded away by default so a canvas node stays compact enough to see its neighbours.
 */
export async function openAnalysis(card: Locator): Promise<void> {
	const summary = card.locator('details.analysis > summary');
	if ((await card.locator('details.analysis[open]').count()) === 0) await summary.click();
}
