import { expect, type Page, type Locator } from '@playwright/test';

/**
 * Open the bench. "." resolves against baseURL, so the same suite passes whether the app is
 * served at the origin root or under a GitHub Pages sub-path (BASE_PATH=/darwinlab). A
 * goto('/') would not: an absolute path resolves against the origin and escapes the base.
 *
 * The lab opens on the INTRO screen — enter it the way a user does (the button), and wait for the
 * fade to land. Then, on a desktop-sized viewport, re-frame the camera to fit the whole tree: the
 * product default is 100% zoom centred on the tree, which deliberately leaves the outer worlds a
 * pan away — correct for a person, but every suite here interacts with tiles across the bench, so
 * they all start from the fitted framing. (A phone viewport skips this: fitting five worlds into
 * 375px makes every node an untappable sliver, and at 100% its first node is already in view.)
 */
export async function gotoApp(page: Page): Promise<void> {
	await page.goto('.');
	// Enter by KEY, not by clicking the Enter button: a click's own actionability mouse-move can
	// dismiss the intro first (any interaction enters), and the click then chases a detaching button.
	// A keypress has no hit-testing to race.
	await expect(page.getByTestId('intro')).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('intro')).toBeHidden();
	if ((page.viewportSize()?.width ?? 1280) >= 700) {
		await page.getByRole('button', { name: 'recenter the tree' }).click();
	}
}

/**
 * Wait for the load-time prewarm to have LANDED.
 *
 * This used to wait for the turbo pill to appear and then vanish — but the prewarm runs behind the
 * intro, and entering the lab takes long enough (the fade alone is 700ms) that on a fast machine
 * the burst is already over before the first look: waiting for the pill to APPEAR then hangs on a
 * pill that came and went. So wait for the burst's POSTCONDITION instead: the first world trained
 * to the prewarm generation (15; the range allows a slow run to have started gen 16+ live) — and
 * THEN the pill gone, because tile 0 can reach 15 while the burst is still finishing its siblings,
 * and a reset clicked in that window is retrained right back up by the running turbo (it was; the
 * reset e2e caught it). The gen check proves hydration happened, which is what made a bare
 * `toBeHidden` a trap on its own.
 */
export async function waitForPrewarm(page: Page): Promise<void> {
	await expect(page.getByTestId('gen').first()).toHaveText(/Gen 1[5-9]/, { timeout: 90_000 });
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

/** Switch the lab to Research and open the Atlas instrument. Assumes the bench is already open. */
export async function openAtlas(page: Page): Promise<void> {
	await page
		.getByRole('radiogroup', { name: 'lab mode' })
		.getByRole('radio', { name: 'Research' })
		.click();
	await page.getByRole('tab', { name: 'The Atlas' }).click();
	await page.getByTestId('atlas').waitFor();
}

/**
 * Shrink the Atlas to the smallest real grid (3×3 at two seeds) and PROVE it applied before running.
 * The store reads the inputs on `change`, so this waits for the summary to confirm the new size — a
 * run kicked off on the assumption the change fired could silently measure the full default grid.
 */
export async function shrinkAtlasRun(page: Page): Promise<void> {
	const grid = page.locator('[data-testid="atlas"] .num input').first();
	const seeds = page.locator('[data-testid="atlas"] .num input').nth(1);
	await grid.fill('3');
	await grid.blur();
	await seeds.fill('2');
	await seeds.blur();
	await expect(page.getByTestId('atlas-summary')).toContainText('9 cells × 2 seeds');
}
