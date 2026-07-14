import { expect, test, type Page } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

/**
 * The Phase 9 responsive gate: usable and coherent at 375px, with a coarse pointer.
 *
 * `isMobile` + `hasTouch` is what makes `(pointer: coarse)` match, so the touch-target rules
 * under test here are actually active — a plain narrow viewport would test the layout while
 * silently skipping the ergonomics.
 */

test.use({ viewport: { width: 375, height: 730 }, isMobile: true, hasTouch: true });

const overflow = (page: Page) =>
	page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.beforeEach(async ({ page }) => {
	await gotoApp(page);
	await waitForPrewarm(page);
});

test('the bench fits a phone: one column, the run controls on the rail, no sideways scroll', async ({
	page
}) => {
	expect(await overflow(page)).toBe(0);

	/*
	 * A phone has no room to dock the control panel, so it lives behind the rail — but the RUN
	 * controls are the ones you reach for mid-experiment, and the rail is what keeps them one tap
	 * away instead of behind a panel. They are here, and they are finger-sized.
	 */
	const pause = page.getByRole('button', { name: 'Pause' });
	await expect(pause).toBeVisible();
	await expect(page.getByRole('button', { name: 'Play story' })).toBeVisible();

	const box = await pause.boundingBox();
	expect(box!.height).toBeGreaterThanOrEqual(44); // the coarse-pointer rules are live
});

test('the control panel opens over the bench, with the full controls on it', async ({ page }) => {
	// The panel is an OVERLAY here: it starts shut, so the bench is what a phone opens on.
	await expect(page.getByRole('radio', { name: '1×' })).toBeHidden();

	await page.getByRole('button', { name: 'expand the controls' }).tap();

	// what the rail could not fit: the speed control in full, and the run manifest
	const speed = page.getByRole('radio', { name: '1×' });
	await expect(speed).toBeVisible();
	await expect(page.getByTestId('run-manifest')).toBeVisible();
	expect((await speed.boundingBox())!.height).toBeGreaterThanOrEqual(40);
	expect(await overflow(page)).toBe(0);

	// and it gets out of the way again
	await page.getByRole('button', { name: 'close the controls' }).tap();
	await expect(speed).toBeHidden();
});

test('the conditions dialog becomes a full-screen sheet', async ({ page }) => {
	await page.getByRole('button', { name: 'Conditions' }).first().tap();
	const dialog = page.getByRole('dialog', { name: /conditions/i });
	await expect(dialog).toBeVisible();

	const panel = await page.evaluate(() => {
		const el = document.querySelector('dialog .panel')!;
		const rect = el.getBoundingClientRect();
		return { width: rect.width, radius: getComputedStyle(el).borderRadius };
	});
	expect(panel.width).toBe(375); // the whole viewport, not a keyhole
	expect(panel.radius).toBe('0px'); // a sheet, not a floating card
});

test('the inspector becomes a full-width overlay', async ({ page }) => {
	await page.getByRole('button', { name: 'Champion' }).first().tap();
	const drawer = page.getByRole('dialog', { name: /fish mind/i });
	await expect(drawer).toBeVisible();

	// Poll: the drawer slides in, and a bounding box taken mid-animation measures the flight.
	await expect.poll(async () => (await drawer.boundingBox())!.x).toBe(0);
	expect((await drawer.boundingBox())!.width).toBe(375); // edge to edge
	expect(await overflow(page)).toBe(0);
});

test('the film stacks: tank first, rails beneath, nothing sideways', async ({ page }) => {
	await page.getByRole('button', { name: 'Play story' }).tap();
	const story = page.getByRole('dialog', { name: 'story mode' });
	await expect(story).toBeVisible();

	expect(
		await page.evaluate(() => getComputedStyle(document.querySelector('.stage')!).flexDirection)
	).toBe('column');
	expect(await overflow(page)).toBe(0);

	// the honesty line wrapped rather than disappearing — a presentation is when it matters
	await expect(story.getByText('a teaching caricature')).toBeVisible();
});
