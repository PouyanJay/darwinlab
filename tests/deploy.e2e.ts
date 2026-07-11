import { expect, test, type Page } from '@playwright/test';

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

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('turbo')).toBeHidden({ timeout: 90_000 }); // prewarmed to gen 15
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
	await deployAt(page, 20);
	await expect(page.getByRole('button', { name: /Train to gen 20/ })).toBeVisible();

	await page.getByRole('button', { name: /Train to gen 20/ }).click();
	await expect(page.getByTestId('turbo')).toBeHidden({ timeout: 120_000 });

	// training is over, and the tile says so rather than leaving it to be inferred
	await expect(tile(page, 2).getByTestId('gen')).toHaveText('Gen 20 · trained');

	// the real-world run is now reporting: seconds elapsed and how many are left
	await expect.poll(() => deployment(page, 2), { timeout: 20_000 }).toMatch(/^\d+s · \d+ left$/);

	// AND IT ONLY GOES DOWN. A respawn slipping into deployed mode is the one bug that would turn
	// this whole act into a lie — you would be watching a population that cannot actually die.
	await page.getByRole('radio', { name: '2×' }).click();
	let previous = await alive(page, 2);
	for (let i = 0; i < 40 && previous > 0; i++) {
		const now = await alive(page, 2);
		expect(now, 'a deployed population climbed back — something respawned').toBeLessThanOrEqual(
			previous
		);
		previous = now;
		await page.waitForTimeout(500);
	}

	// it ends the only way it can
	await expect.poll(() => alive(page, 2), { timeout: 120_000 }).toBe(0);
	await expect.poll(() => deployment(page, 2)).toMatch(/^wiped out · \d+s$/);
	await expect(tile(page, 2).getByTestId('eaten')).toHaveText('−20'); // every last one of them
});

test('the generation stops climbing once a world is deployed', async ({ page }) => {
	await deployAt(page, 20);
	await page.getByRole('button', { name: /Train to gen 20/ }).click();
	await expect(page.getByTestId('turbo')).toBeHidden({ timeout: 120_000 });
	await expect(tile(page, 2).getByTestId('gen')).toHaveText('Gen 20 · trained');

	// 10 sim-seconds is a generation; at 2× a few of them would pass. None do.
	await page.getByRole('radio', { name: '2×' }).click();
	await page.waitForTimeout(6000);

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
