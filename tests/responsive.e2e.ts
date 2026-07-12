import { expect, test, type Page } from '@playwright/test';
import { waitForPrewarm } from './helpers';

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
	await page.goto('/');
	await waitForPrewarm(page);
});

test('the bench fits a phone: one column, every control present, no sideways scroll', async ({
	page
}) => {
	expect(await overflow(page)).toBe(0);

	// the priority controls survived the narrow bar
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Play story' })).toBeVisible();
	await expect(page.getByRole('radio', { name: '1×' })).toBeVisible();

	// and they are finger-sized — the coarse-pointer rules are live
	const box = await page.getByRole('button', { name: 'Pause' }).boundingBox();
	expect(box!.height).toBeGreaterThanOrEqual(44);
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
	await page.getByRole('button', { name: '★ Champion' }).first().tap();
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
