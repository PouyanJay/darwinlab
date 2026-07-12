import { expect, test, type Page } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

/**
 * The Phase 7 gate: the second act, driven in the real app.
 *
 * Training is the part everyone expects. Deployment is the part that makes it an argument: evolution
 * stops, the resets stop, and the population that was bred has to survive on its own. The claim the
 * whole act rests on is that it CANNOT be saved — nothing respawns — so that is what gets watched
 * here, frame after frame, rather than merely asserted once at the end.
 */

const tile = (page: Page, index: number) => page.locator('section[aria-label^="world"]').nth(index);
const alive = (page: Page, index: number) =>
	tile(page, index).getByTestId('alive').innerText().then(Number);
const deployment = (page: Page, index: number) =>
	tile(page, index).getByTestId('deployment').innerText();

/** Set the bench-wide training horizon through the UI, the way a user does. */
async function deployAt(page: Page, generation: number) {
	await page.getByRole('button', { name: 'lab settings' }).click();
	await page.getByRole('slider', { name: /deploy at/i }).fill(String(generation));
	await page.keyboard.press('Escape');
}

/**
 * Make the run ACTUALLY end, through the Conditions dialog, the way a user would: more sharks, and
 * sharks fast enough to catch a fish.
 *
 * The bench's shark cruises at 140 px/s and a fish tops out at 176 — that inversion is the whole
 * reason a sense pays here (fleeing the right way finally means getting away). It also means a
 * well-evolved fish can OUTRUN every shark in the tank, forever, and persistence is off, so nothing
 * escalates to end the stalemate. Extinction has no time bound any more.
 *
 * So a test that waits for "wiped out" on the default bench is not testing the deploy lifecycle —
 * it is betting that no fish gets away, and it loses that bet on a slow machine (it lost in CI).
 * Cranking the predator speed past what a fish can swim restores the guarantee, and every claim
 * under test — nothing respawns, the generation is frozen, the run is reported — is indifferent to
 * how the fish came to die.
 */
async function makeTheRunEnd(page: Page, index: number) {
	await tile(page, index).getByRole('button', { name: 'Conditions' }).click();
	const conditions = page.getByRole('dialog', { name: 'Conditions' });
	for (let i = 0; i < 3; i++) {
		await conditions.getByRole('button', { name: 'more predators' }).click(); // 3 → 6, the cap
	}
	// 1.8× → a 360 px/s cruise against a fish's 176: no fish can simply run away any more
	await conditions.getByRole('slider', { name: /predator speed/i }).fill('1.8');
	await page.keyboard.press('Escape');
	await expect(conditions).toBeHidden();
}

test.beforeEach(async ({ page }) => {
	await gotoApp(page);
	await waitForPrewarm(page);
});

test('the bench opens with a training horizon, and the Train button names it', async ({ page }) => {
	await expect(page.getByRole('button', { name: /Train to gen 150/ })).toBeVisible();

	// nothing is deployed yet — there are 135 generations still to go
	expect(await deployment(page, 2)).toBe('after training');
	await expect(tile(page, 2).getByTestId('gen')).toHaveText('Gen 15');
});

test('THE SECOND ACT: train to the horizon, and the population has to survive on its own', async ({
	page
}) => {
	// The bench's generations are 30 sim-seconds now (they were 10), so training to the horizon is
	// three times the turbo work it used to be, and the deployed run that follows is a real one:
	// measured headlessly, these evolved populations take 16–34 sim-seconds to be wiped out. The
	// default 30s budget covers none of that — and a test that dies of impatience reads exactly
	// like a test that caught a bug.
	test.setTimeout(240_000);
	await makeTheRunEnd(page, 2); // the default bench has no guarantee of extinction — see the helper
	await deployAt(page, 20);
	await expect(page.getByRole('button', { name: /Train to gen 20/ })).toBeVisible();

	await page.getByRole('button', { name: /Train to gen 20/ }).click();
	await expect(page.getByTestId('turbo')).toBeHidden({ timeout: 120_000 });

	// training is over, and the tile says so rather than leaving it to be inferred
	await expect(tile(page, 2).getByTestId('gen')).toHaveText('Gen 20 · trained');

	// the real-world run is now reporting: seconds elapsed and how many are left
	await expect.poll(() => deployment(page, 2), { timeout: 20_000 }).toMatch(/^\d+s · \d+ left$/);

	/*
	 * AND IT ONLY GOES DOWN. A respawn slipping into deployed mode is the one bug that would turn this
	 * whole act into a lie — you would be watching a population that cannot actually die.
	 *
	 * Watched by an observer inside the page rather than by polling from out here: sampling every
	 * 500ms would let a population climb back and be eaten down again between two looks, and the test
	 * would never know. The observer sees every single update the app makes to that number.
	 */
	await tile(page, 2)
		.getByTestId('alive')
		.evaluate((el: HTMLElement) => {
			const seen: number[] = [Number(el.textContent)];
			(window as unknown as { aliveSeen: number[] }).aliveSeen = seen;
			new MutationObserver(() => seen.push(Number(el.textContent))).observe(el, {
				childList: true,
				characterData: true,
				subtree: true
			});
		});

	await page.getByRole('radio', { name: '2×' }).click();

	// it ends the only way it can
	await expect.poll(() => alive(page, 2), { timeout: 120_000 }).toBe(0);
	await expect.poll(() => deployment(page, 2)).toMatch(/^wiped out · \d+s$/);
	await expect(tile(page, 2).getByTestId('eaten')).toHaveText('−20'); // every last one of them

	const seen = await page.evaluate(() => (window as unknown as { aliveSeen: number[] }).aliveSeen);
	expect(seen.length, 'the observer saw nothing at all').toBeGreaterThan(5);
	for (let i = 1; i < seen.length; i++) {
		expect(
			seen[i],
			`a deployed population climbed back: ${seen.slice(0, i + 1).join(' → ')}`
		).toBeLessThanOrEqual(seen[i - 1]);
	}
});

test('the generation stops climbing once a world is deployed', async ({ page }) => {
	test.setTimeout(240_000);
	await makeTheRunEnd(page, 2); // the default bench has no guarantee of extinction — see the helper
	await deployAt(page, 20);
	await page.getByRole('button', { name: /Train to gen 20/ }).click();
	await expect(page.getByTestId('turbo')).toBeHidden({ timeout: 120_000 });
	await expect(tile(page, 2).getByTestId('gen')).toHaveText('Gen 20 · trained');

	/*
	 * Wait on the SIMULATION, not on the clock — but wait for the RIGHT thing. This test used to poll
	 * the run's elapsed seconds out of the readout, and that readout changes shape as the run goes on:
	 * the moment the half-life latches it becomes "half-life 4s · 8 left", so the regex started reading
	 * 4 and the poll could never pass. It only went green when the half-life happened to land late.
	 *
	 * The end of the run is unambiguous, so wait for that. It takes tens of sim-seconds — several
	 * generations, had this world still been evolving. None pass.
	 */
	await page.getByRole('radio', { name: '2×' }).click();
	await expect.poll(() => deployment(page, 2), { timeout: 120_000 }).toMatch(/^wiped out · \d+s$/);

	await expect(tile(page, 2).getByTestId('gen')).toHaveText('Gen 20 · trained');
});

test('resetting a deployed world puts it back to evolving, cleanly', async ({ page }) => {
	await deployAt(page, 20);
	await page.getByRole('button', { name: /Train to gen 20/ }).click();
	await expect(page.getByTestId('turbo')).toBeHidden({ timeout: 120_000 });
	await expect(tile(page, 2).getByTestId('gen')).toHaveText('Gen 20 · trained');

	await tile(page, 2).getByRole('button', { name: 'reset world' }).click();

	await expect(tile(page, 2).getByTestId('gen')).toHaveText('Gen 0'); // evolving again, from scratch
	await expect.poll(() => deployment(page, 2)).toBe('after training');
	await expect.poll(() => alive(page, 2)).toBeGreaterThan(0); // a full generation is back in the water
});

test('a limit of zero means the bench never deploys', async ({ page }) => {
	await deployAt(page, 0);

	// the button stops naming a destination, because there is not one any more
	await expect(page.getByRole('button', { name: /Train \+25 gens/ })).toBeVisible();
	await page.getByRole('button', { name: /Train \+25 gens/ }).click();
	await expect(page.getByTestId('turbo')).toBeHidden({ timeout: 120_000 });

	await expect(tile(page, 2).getByTestId('gen')).not.toContainText('trained');
	expect(await deployment(page, 2)).toBe('after training');
});
