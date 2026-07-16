import { expect, test, type Page } from '@playwright/test';

/**
 * The intro — the claim and the method, full-screen, gone on the first interaction.
 *
 * These tests deliberately do NOT use gotoApp(): that helper enters the lab and re-frames the
 * camera for the other suites, and what is under test here is exactly what gotoApp skips past —
 * that the intro is really there, that entering it reveals the true product default (100% zoom,
 * the worlds centred), and that the keypress which enters does not ALSO drive the bench.
 */

const intro = (page: Page) => page.getByTestId('intro');

test.beforeEach(async ({ page }) => {
	await page.goto('.');
	// The app is client-rendered: until the intro is on screen its listeners are not attached, and a
	// keypress or click fired into that gap dismisses nothing. Every interaction waits for it first.
	await expect(intro(page)).toBeVisible();
});

test('the lab opens on the intro, and the bench behind it is inert', async ({ page }) => {
	await expect(intro(page)).toBeVisible();
	await expect(intro(page).getByRole('heading', { level: 1 })).toContainText(
		'Behaviour that evolved'
	);
	// the platform is genuinely behind it, suppressed — not absent
	await expect(page.locator('.app')).toHaveAttribute('inert', '');
});

test('entering reveals the default framing: 100% zoom, the worlds centred on the canvas', async ({
	page
}) => {
	// a raw click (no actionability retries): clicking anywhere on the intro is a way in, and the
	// pre-click hit-testing of a locator click would race the mouse-move dismissal
	await page.mouse.click(600, 300);
	await expect(intro(page)).toBeHidden();

	await expect(page.locator('.zoom-readout')).toHaveText('100%');

	// the tree's bounding box is centred in the canvas — the union of every node's box
	const nodes = page.locator('section[aria-label^="world"]');
	const count = await nodes.count();
	let minX = Infinity;
	let maxX = -Infinity;
	for (let i = 0; i < count; i++) {
		const b = (await nodes.nth(i).boundingBox())!;
		minX = Math.min(minX, b.x);
		maxX = Math.max(maxX, b.x + b.width);
	}
	const canvas = (await page.locator('.canvas').boundingBox())!;
	const treeCentre = (minX + maxX) / 2;
	const canvasCentre = canvas.x + canvas.width / 2;
	expect(Math.abs(treeCentre - canvasCentre)).toBeLessThan(3);
});

test('any key enters — and the keypress does not leak into the bench underneath', async ({
	page
}) => {
	// Space is the bench's play/pause shortcut; while the intro is up it must mean only "enter".
	await page.keyboard.press(' ');
	await expect(intro(page)).toBeHidden();
	// the sim is still RUNNING — the transport offers Pause, so the Space did not reach it
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
});

test('moving the mouse enters, once the intro has had a moment to be read', async ({ page }) => {
	// the mouse-move dismissal arms after ~900ms so load-time cursor jitter cannot kill the screen
	await page.waitForTimeout(1400);
	await page.mouse.move(400, 300);
	await page.mouse.move(420, 320);
	await expect(intro(page)).toBeHidden();
});
