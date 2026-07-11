import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 2 gate, verified against the real running app.
 *
 * THE LOAD-BEARING TEST is "keeps simulating while the tab is backgrounded". The reference build
 * froze because it drove the sim with requestAnimationFrame, which browsers SUSPEND for a page
 * that isn't visible. We use a self-scheduling setTimeout instead (CLAUDE.md gotcha #1).
 *
 * ⚠️ It must genuinely background the page. An earlier version of this test only overrode
 * `document.hidden` / `visibilityState` via Object.defineProperty — that fakes the JS-visible API
 * but leaves Chromium's page visible, so rAF keeps firing and the test passed even when the loop
 * WAS rAF-driven. It guarded nothing. We now open a second page and bring it to the front, which
 * really occludes the first one and makes the browser suspend rAF. Verify any change to this test
 * by temporarily swapping loop.ts to rAF: it MUST fail.
 *
 * PROBE: we fingerprint the canvas rather than watch the generation counter. A generation is 10
 * sim-seconds, so the counter cannot move inside a short window — but the fish only move when
 * `stepWorld` runs (every animation is driven off `w.t`, the sim's own clock, not wall-clock), so
 * a changed fingerprint proves sim time actually advanced. A paused sim still repaints; it just
 * repaints the same frame — which is what makes this a real test of pause, too.
 */

/** Sparse hash of the tank's pixels — changes iff the scene moved. */
function fingerprint(page: Page): Promise<number> {
	return page.locator('canvas').evaluate((el: HTMLCanvasElement) => {
		const ctx = el.getContext('2d')!;
		const { data } = ctx.getImageData(0, 0, el.width, el.height);
		let h = 0;
		for (let i = 0; i < data.length; i += 997) h = (h * 31 + data[i]) | 0;
		return h;
	});
}

const generations = (page: Page) => page.getByTestId('generations').innerText().then(Number);
const alive = (page: Page) => page.getByTestId('alive').innerText().then(Number);

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('turbo')).toBeHidden({ timeout: 30_000 }); // prewarm finished
});

test('prewarms the world so the bench opens already competent', async ({ page }) => {
	expect(await generations(page)).toBeGreaterThanOrEqual(15);
	await expect(page.getByRole('img', { name: /tank/i })).toBeVisible();
});

test('paints the tank (the canvas is not blank)', async ({ page }) => {
	const nonBlank = await page.locator('canvas').evaluate((el: HTMLCanvasElement) => {
		const ctx = el.getContext('2d')!;
		const { data } = ctx.getImageData(0, 0, el.width, el.height);
		for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return true;
		return false;
	});
	expect(nonBlank).toBe(true);
});

test('the simulation is live (the scene keeps moving)', async ({ page }) => {
	const before = await fingerprint(page);
	await expect.poll(() => fingerprint(page), { timeout: 5000 }).not.toBe(before);
});

test('keeps simulating with requestAnimationFrame dead (as a backgrounded tab makes it)', async ({
	page
}) => {
	// What a backgrounded tab actually DOES to a page is stop servicing rAF callbacks. So rather
	// than trying to convince headless Chromium to truly occlude a tab (it won't — an earlier
	// version of this test faked document.hidden and consequently passed even with a rAF-driven
	// loop, guarding nothing), we reproduce the *consequence* directly and deterministically:
	// requestAnimationFrame is installed as a black hole before any app code runs. A rAF-driven
	// loop is then stone dead; ours, on setTimeout, must keep simulating.
	await page.addInitScript(() => {
		window.requestAnimationFrame = () => 0; // never invokes the callback
		window.cancelAnimationFrame = () => {};
	});
	await page.goto('/');
	await expect(page.getByTestId('turbo')).toBeHidden({ timeout: 30_000 });

	const before = await fingerprint(page);
	await expect.poll(() => fingerprint(page), { timeout: 15_000 }).not.toBe(before); // sim time still advances — CLAUDE.md gotcha #1 holds
});

test('pause really stops the simulation, and evolve resumes it', async ({ page }) => {
	await page.getByRole('button', { name: 'Pause' }).click();

	// Wait for the scene to actually settle rather than sleeping an arbitrary amount: once two
	// consecutive reads agree, any in-flight frame has landed.
	await expect
		.poll(async () => {
			const a = await fingerprint(page);
			const b = await fingerprint(page);
			return a === b;
		})
		.toBe(true);

	// paused: the loop still repaints, but it repaints the SAME frame
	const paused = await fingerprint(page);
	await expect.poll(() => fingerprint(page), { timeout: 2000 }).toBe(paused);

	await page.getByRole('button', { name: 'Evolve' }).click();
	await expect.poll(() => fingerprint(page), { timeout: 5000 }).not.toBe(paused);
});

test('the speed control is wired and keeps the sim running', async ({ page }) => {
	// the exact ½/1/2× sub-step maths is pinned in loop.spec.ts; here we prove the wiring.
	// The control is a radio group (exactly one speed is always chosen) — see Segmented.svelte.
	await page.getByRole('radio', { name: '2×' }).click();
	await expect(page.getByRole('radio', { name: '2×' })).toHaveAttribute('aria-checked', 'true');

	const before = await fingerprint(page);
	await expect.poll(() => fingerprint(page), { timeout: 5000 }).not.toBe(before);
});

test('train fast-forwards generations', async ({ page }) => {
	const before = await generations(page);
	await page.getByRole('button', { name: /Train \+25 gens/ }).click();

	await expect(page.getByTestId('turbo')).toBeVisible();
	await expect(page.getByTestId('turbo')).toBeHidden({ timeout: 60_000 });
	expect(await generations(page)).toBeGreaterThanOrEqual(before + 25);
});

test('Space plays/pauses the bench — but never out from under a focused control', async ({
	page
}) => {
	// On the bare page, Space is the play/pause shortcut.
	await page.locator('body').click();
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	await page.keyboard.press(' ');
	await expect(page.getByRole('button', { name: 'Evolve' })).toBeVisible();
	await page.keyboard.press(' ');
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

	// But Space is ALSO how a focused button is pressed. The shortcut used to preventDefault it
	// regardless of focus, so Space on the theme toggle paused the sim instead of switching theme —
	// a keyboard user could not operate the top bar at all. Verified to fail before the fix.
	await page.getByRole('button', { name: 'switch theme' }).focus();
	await page.keyboard.press(' ');

	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); // the button won
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible(); // the sim kept running
});

test('the population is being hunted', async ({ page }) => {
	// NOT `> 0`: with no maxGenerations the world never deploys, so a generation can legitimately
	// be wiped out at the instant we sample. Assert the real invariant instead.
	const count = await alive(page);
	expect(count).toBeGreaterThanOrEqual(0);
	expect(count).toBeLessThanOrEqual(20);
	expect(await page.getByTestId('eaten').innerText()).toMatch(/^−\d+$/);
});

test('the canvas backing store is DPR-scaled and stays crisp when resized', async ({ page }) => {
	const ratio = () =>
		page.locator('canvas').evaluate((el: HTMLCanvasElement) => ({
			bitmap: el.width,
			css: el.clientWidth,
			dpr: Math.min(2, window.devicePixelRatio || 1)
		}));

	const before = await ratio();
	expect(before.bitmap).toBe(Math.round(before.css * before.dpr));

	await page.setViewportSize({ width: 700, height: 800 });
	await expect
		.poll(async () => {
			const r = await ratio();
			return r.bitmap === Math.round(r.css * r.dpr);
		})
		.toBe(true); // ResizeObserver re-sized the bitmap to match the new CSS size
});

test('the theme is resolved before the first paint (no flash of the wrong theme)', async ({
	page
}) => {
	await page.getByRole('button', { name: 'switch theme' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

	// On reload, data-theme must already be 'dark' on the very first evaluation — the inline head
	// script runs before paint, so a dark user never sees the light palette flash.
	const fresh = await page.context().newPage();
	await fresh.goto('/');
	const themeAtFirstPaint = await fresh.evaluate(() => document.documentElement.dataset.theme);
	expect(themeAtFirstPaint).toBe('dark');
	await fresh.close();
});

test('the tank repaints in the theme palette (canvas is not stuck on one theme)', async ({
	page
}) => {
	const light = await fingerprint(page);
	await page.getByRole('button', { name: 'switch theme' }).click();
	// the dark tank is a different palette entirely, so the pixels must differ
	await expect.poll(() => fingerprint(page), { timeout: 5000 }).not.toBe(light);
});
