import { expect, test } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

/**
 * The MEASUREMENT suite — the two tests that make this a benchmark rather than a demo.
 *
 * They are in their own file because they burn real CPU: an evaluation replicates an environment
 * across independent seeds, and the ablation matrix does it six times over. Run alongside the rest
 * of the suite they starve the other workers, and the sims those tests are watching crawl — which
 * surfaces as a DIFFERENT story or bench test failing on each run, which is the worst kind of
 * flake: one that never accuses the thing actually at fault.
 *
 * playwright.config.ts therefore runs this project only AFTER the app project has finished, so the
 * heavy work happens when nothing else is competing for a core.
 */

test.beforeEach(async ({ page }) => {
	await gotoApp(page);
	await waitForPrewarm(page);
});

test('EVALUATION: a card reports a result with an error bar, and withdraws it when the config changes', async ({
	page
}) => {
	/*
	 * The tank is one population on one seed. This is the control that turns the bench into a
	 * benchmark: replicate the environment across independent seeds, freeze each evolved population
	 * so nothing evolves while it is judged, and state the mean, the error bar and the n.
	 *
	 * And then WITHDRAW it. A result measured at a configuration you have since changed is not an
	 * answer to the question you are now asking, and a number that no longer matches its config is
	 * worse than no number at all.
	 */
	test.setTimeout(240_000);
	const tile = page.locator('section[aria-label^="world"]').nth(2);

	await tile.getByTestId('evaluate').click();
	await expect(tile.getByTestId('eval-return')).toBeVisible({ timeout: 180_000 });
	await expect(tile.getByTestId('eval-return')).toHaveText(/^\d+\.\d\ds$/);
	await expect(tile.locator('.eval')).toContainText('n = 5 seeds');
	await expect(tile.locator('.eval')).toContainText('strikes dodged');

	// the result is NOT stale yet
	await expect(tile.getByTestId('eval-stale')).toHaveCount(0);

	// change the environment out from under it — one sense pill is enough
	await tile.getByRole('button', { name: 'close', exact: true }).click();

	await expect(tile.getByTestId('eval-stale')).toBeVisible();
});

test('THE ABLATION MATRIX: what each observation channel is worth, measured directly', async ({
	page
}) => {
	/*
	 * The bench's environments are cumulative, so an environment carrying a channel that pays and one
	 * that taxes reports their sum and neither shows. This runs the SUBSETS — same environment, same
	 * seeds, equal budgets — and says what each is worth against the blind policy.
	 */
	test.setTimeout(300_000);

	await page.getByTestId('run-ablation').click();

	const matrix = page.getByRole('region', { name: 'ablation matrix' });
	await expect(matrix.getByRole('row', { name: /all four/ })).toBeVisible({ timeout: 240_000 });

	// every subset is reported, each with an error bar and a verdict against blindness
	await expect(matrix.getByRole('row')).toHaveCount(7); // header + six subsets
	await expect(matrix.getByRole('row', { name: /^blind/ })).toContainText('0%'); // the baseline itself
	await expect(matrix).toContainText('populations frozen while scored');
});
