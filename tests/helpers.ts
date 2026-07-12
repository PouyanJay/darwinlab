import { expect, type Page } from '@playwright/test';

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
