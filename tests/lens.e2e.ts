import { expect, test, type Page, type Locator } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

/**
 * The flee lens, in the real app.
 *
 * What is being guarded is the claim the feature makes about itself: it changes what you SEE (the
 * water is repainted, and the card starts reporting a reading) and it changes NOTHING ELSE (the sim
 * carries on exactly as it was). `render/lens.spec.ts` pins the second half at the engine level —
 * frame for frame, weight for weight — so what is left for the browser is that the switch is really
 * wired to the pixels, and that the number and the colours arrive and leave together.
 */

const tile = (page: Page, index: number) => page.locator('section[aria-label^="world"]').nth(index);

/**
 * Scoped to the lens's OWN group. "Off" is not a unique name on this page — every card's champion-
 * clones selector has one too — and a bare name lookup matched six controls and threw. A control is
 * identified by its group first and its label second.
 */
const lens = (page: Page, label: 'Off' | 'Flee error') =>
	page.getByRole('radiogroup', { name: 'tank lens' }).getByRole('radio', { name: label });

/**
 * Hash the tank's pixels.
 *
 * PAUSE FIRST wherever this is compared across an action: against a RUNNING sim the fish have moved
 * by the next frame and the hash differs no matter what the action did — the canvas-fingerprint trap
 * this repo has fallen into before (CLAUDE.md).
 */
const fingerprint = (tank: Locator) =>
	tank.evaluate((el: HTMLCanvasElement) => {
		const { data } = el.getContext('2d')!.getImageData(0, 0, el.width, el.height);
		let h = 0;
		for (let i = 0; i < data.length; i += 251) h = (h * 31 + data[i]) | 0;
		return h;
	});

test.beforeEach(async ({ page }) => {
	await gotoApp(page);
	await waitForPrewarm(page);
});

test('the lens repaints the water — and the plain view comes back', async ({ page }) => {
	await page.getByRole('button', { name: 'Pause' }).click();
	const tank = tile(page, 0).getByRole('application', { name: /tank/i });

	// A paused tank is a still picture: any difference below is the lens, not the fish swimming.
	const plain = await fingerprint(tank);
	expect(await fingerprint(tank)).toBe(plain); // …and it really is still

	await lens(page, 'Flee error').click();
	await expect.poll(() => fingerprint(tank)).not.toBe(plain);

	await lens(page, 'Off').click();
	await expect.poll(() => fingerprint(tank)).toBe(plain); // exactly what it was, to the pixel
});

test('every card reports a reading while the lens is on, and stops when it is off', async ({
	page
}) => {
	const strips = page.getByRole('group', { name: 'flee lens' });
	await expect(strips).toHaveCount(0);

	await lens(page, 'Flee error').click();

	// One lens, one switch, every tank — that is the whole reason it is not a per-card control.
	await expect(strips).toHaveCount(await page.locator('section[aria-label^="world"]').count());

	// The reading is a MEASUREMENT: it refuses to print a mean until it has the fish-time behind it,
	// so what a card shows first is "measuring…", and a number only once the window has filled.
	await expect(tile(page, 0).getByText('measuring')).toBeVisible();
	await expect(tile(page, 0).getByTestId('flee-now')).toBeVisible({ timeout: 60_000 });

	await lens(page, 'Off').click();
	await expect(strips).toHaveCount(0);
});

test('the lens does not stop the bench', async ({ page }) => {
	// It is a way of LOOKING. The sim underneath must not so much as hesitate.
	await lens(page, 'Flee error').click();

	const tank = tile(page, 0).getByRole('application', { name: /tank/i });
	const before = await fingerprint(tank);
	await expect.poll(() => fingerprint(tank), { timeout: 5000 }).not.toBe(before); // still swimming
});
