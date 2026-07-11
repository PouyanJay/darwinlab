import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 2 gate, verified against the real running app.
 *
 * The load-bearing test is "keeps simulating while the tab is hidden": the reference build froze
 * because it drove the sim with requestAnimationFrame, which browsers suspend offscreen. We use a
 * self-scheduling setTimeout instead (CLAUDE.md gotcha #1) — this test is what stops anyone
 * quietly reverting that.
 *
 * PROBE: we fingerprint the canvas rather than watch the generation counter. A generation is 10
 * sim-seconds, so the counter cannot move inside a short window — but the fish only move when
 * `stepWorld` runs, so a changed fingerprint proves sim time actually advanced. (A paused sim
 * still repaints, it just repaints the same frame — which is exactly what makes this a real test
 * of pause, too.)
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

const generations = (page: Page) => page.locator('.readout b').innerText().then(Number);
const alive = (page: Page) => page.locator('.stat b').first().innerText().then(Number);

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.turbo')).toBeHidden({ timeout: 30_000 }); // prewarm finished
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

test('keeps simulating while the tab is hidden (rAF would have frozen)', async ({ page }) => {
	// report the page as hidden, exactly as a backgrounded tab does
	await page.evaluate(() => {
		Object.defineProperty(document, 'visibilityState', {
			get: () => 'hidden',
			configurable: true
		});
		Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	expect(await page.evaluate(() => document.hidden)).toBe(true);

	const before = await fingerprint(page);
	await expect
		.poll(() => fingerprint(page), { timeout: 15_000 })
		.not.toBe(before); // sim time advanced while hidden — rAF would have frozen here
});

test('pause really stops the simulation, and evolve resumes it', async ({ page }) => {
	await page.getByRole('button', { name: 'Pause' }).click();
	await page.waitForTimeout(500); // let any in-flight frame land

	// paused: the loop still repaints, but it repaints the SAME frame
	const paused = await fingerprint(page);
	await page.waitForTimeout(2000);
	expect(await fingerprint(page)).toBe(paused);

	await page.getByRole('button', { name: 'Evolve' }).click();
	await expect.poll(() => fingerprint(page), { timeout: 5000 }).not.toBe(paused);
});

test('the speed control is wired and keeps the sim running', async ({ page }) => {
	// the exact ½/1/2× sub-step maths is pinned in loop.spec.ts; here we prove the wiring
	await page.getByRole('button', { name: '2×' }).click();
	await expect(page.getByRole('button', { name: '2×' })).toHaveAttribute('aria-pressed', 'true');

	const before = await fingerprint(page);
	await expect.poll(() => fingerprint(page), { timeout: 5000 }).not.toBe(before);
});

test('train fast-forwards generations', async ({ page }) => {
	const before = await generations(page);
	await page.getByRole('button', { name: /Train \+25 gens/ }).click();

	await expect(page.locator('.turbo')).toBeVisible();
	await expect(page.locator('.turbo')).toBeHidden({ timeout: 60_000 });
	expect(await generations(page)).toBeGreaterThanOrEqual(before + 25);
});

test('the population is alive and being hunted', async ({ page }) => {
	const count = await alive(page);
	expect(count).toBeGreaterThan(0);
	expect(count).toBeLessThanOrEqual(20);
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

test('the theme toggle persists across a reload', async ({ page }) => {
	await page.getByRole('button', { name: 'switch theme' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
