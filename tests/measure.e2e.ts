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

test("THE ABLATION MATRIX is PER CARD: it runs in that environment's own conditions", async ({
	page
}) => {
	/*
	 * The point of the fix this test exists for: a channel is worth exactly what ITS OWN environment
	 * makes it worth. Boundary rays pay in a world with no free wall-avoidance and are worthless in
	 * one that has it; bearing pays when the adversary is slow enough to escape and buys nothing when
	 * it is not. A single bench-wide matrix — which is what shipped first — answered a question
	 * nobody asked, because it measured somebody else's tank.
	 */
	test.setTimeout(300_000);
	const tile = page.locator('section[aria-label^="world"]').nth(2);
	const matrix = tile.getByRole('region', { name: /ablation matrix/ });

	// every card carries its own, and it is on the card — not once at the bottom of the bench
	await expect(page.getByRole('region', { name: /ablation matrix/ })).toHaveCount(5);

	await matrix.getByRole('button', { name: 'ablation matrix', exact: true }).click();
	await matrix.getByTestId('run-ablation').click();

	await expect(matrix.getByRole('row', { name: /all four/ })).toBeVisible({ timeout: 240_000 });
	await expect(matrix.getByRole('row')).toHaveCount(7); // header + six observation subsets
	await expect(matrix.getByRole('row', { name: /^blind/ })).toContainText('0%'); // the baseline

	/*
	 * AND IT BELONGS TO THESE CONDITIONS. Change what the environment IS — not its pills, which the
	 * matrix varies itself — and the numbers stop describing it. They are struck through and said so,
	 * rather than sitting there answering a question about a tank that no longer exists.
	 */
	await tile.getByRole('button', { name: 'Conditions' }).click();
	const conditions = page.getByRole('dialog', { name: 'Conditions' });
	await conditions
		.getByRole('radiogroup', { name: /which part of the experiment/i })
		.getByRole('radio', { name: 'Adversary' })
		.click();
	await conditions.getByRole('slider', { name: /cruise speed/i }).fill('1.4');
	await page.keyboard.press('Escape');

	await expect(matrix.getByTestId('ablation-stale')).toBeVisible();
});
