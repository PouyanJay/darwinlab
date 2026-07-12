import { expect, test, type Page } from '@playwright/test';

/**
 * The Phase 6 gate: a real evolved mind, inspected in the real app.
 *
 * The panel's claim is that everything in it belongs to the fish — its senses this frame, its 68
 * weights, the motor outputs those weights just produced. So the tests drive it the way a user
 * does, and the ablation test checks the thing that makes this a lab rather than a demo: cutting a
 * neuron really does change the brain.
 */

const tile = (page: Page, index: number) => page.locator('section[aria-label^="world"]').nth(index);
const inspector = (page: Page) => page.getByRole('dialog', { name: /Fish mind/ });

/** The brain canvas, hashed. Changes iff the picture changed. */
const brainprint = (page: Page) =>
	inspector(page)
		.getByRole('img', { name: /brain/i })
		.evaluate((el: HTMLCanvasElement) => {
			const { data } = el.getContext('2d')!.getImageData(0, 0, el.width, el.height);
			let h = 0;
			for (let i = 0; i < data.length; i += 397) h = (h * 31 + data[i]) | 0;
			return h;
		});

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	// appear THEN go — toBeHidden alone also passes before hydration renders the pill at all
	await expect(page.getByTestId('turbo')).toBeVisible({ timeout: 30_000 });
	await expect(page.getByTestId('turbo')).toBeHidden({ timeout: 90_000 });
});

test('★ Champion opens a live mind, and the bench keeps running behind it', async ({ page }) => {
	await tile(page, 3).getByRole('button', { name: '★ Champion' }).click(); // "Anticipation"

	await expect(inspector(page)).toBeVisible();
	await expect(inspector(page)).toContainText('one real evolved brain in “Anticipation”');
	await expect(inspector(page)).toContainText('68 genes');

	// NOT a modal: you inspect a brain while watching it swim, so the bench behind stays live and
	// clickable — the Conditions button on another tile still works.
	expect(await inspector(page).evaluate((el) => el.matches(':modal'))).toBe(false);
	await tile(page, 0).getByRole('button', { name: 'Conditions' }).click();
	await expect(page.getByRole('dialog', { name: 'Conditions' })).toBeVisible();
});

test('the panel is alive: the numbers move because the fish is thinking', async ({ page }) => {
	await tile(page, 3).getByRole('button', { name: '★ Champion' }).click();

	const lived = () =>
		inspector(page)
			.getByLabel('lived')
			.innerText()
			.then((text) => Number(text.replace('s', '')));

	const before = await lived();
	await expect.poll(lived, { timeout: 5000 }).toBeGreaterThan(before); // it is surviving, live
});

test('ABLATION: cutting the closing-speed neuron really changes the brain', async ({ page }) => {
	await tile(page, 3).getByRole('button', { name: '★ Champion' }).click(); // has closing speed on
	await expect(inspector(page)).toContainText('closing speed');

	// Pause: the brain canvas animates its signal pulses every frame, so against a running sim its
	// pixels would change regardless and this test would prove nothing.
	await page.getByRole('button', { name: 'Pause' }).click();
	await expect
		.poll(async () => {
			const [a, b] = [await brainprint(page), await brainprint(page)];
			return a === b;
		})
		.toBe(true);
	const wired = await brainprint(page);

	await inspector(page).getByRole('button', { name: 'Ablate — cut closing speed' }).click();

	// the input node dims and its edges go dead — the picture must change
	await expect.poll(() => brainprint(page), { timeout: 5000 }).not.toBe(wired);
	// the CLOSING bar now says the neuron is gone, not that the threat is (walls is already off in
	// this world, so an unscoped "off" would match either bar and prove nothing)
	await expect(inspector(page).getByRole('status', { name: 'closing speed' })).toHaveText('off');
	// and it is the same live ablation the tile performs: the tile's pill agrees
	await expect(tile(page, 3).getByRole('button', { name: 'close', exact: true })).toHaveAttribute(
		'aria-pressed',
		'false'
	);

	// and it heals back
	await inspector(page).getByRole('button', { name: 'Restore closing speed' }).click();
	await expect(tile(page, 3).getByRole('button', { name: 'close', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('the ladder reads the senses the world actually gives the brain', async ({ page }) => {
	// every rung the default bench can reach — a ladder that only ever gets checked at two of its
	// rungs is a ladder whose middle can quietly break
	const rungs = [
		[0, 'rung 0 · reflex'], // Blind drift: no predator input at all
		[1, 'rung 1 · tuned reflex'], // Distance: one channel
		[2, 'rung 2 · sensor integration'], // Direction: two channels to combine
		[3, 'rung 3 · prediction'] // Anticipation: closing speed carries the future
	] as const;

	for (const [index, reads] of rungs) {
		await tile(page, index).getByRole('button', { name: '★ Champion' }).click();
		await expect(inspector(page)).toContainText(reads);
		await page.keyboard.press('Escape');
	}
});

test('clicking the shark says there is no brain, by design', async ({ page }) => {
	/*
	 * Find the shark rather than clicking hopefully at the middle of the tank and waiting for one to
	 * swim under the cursor. Pause, read the canvas back, and click where the red is — it exercises
	 * the same pickCreature path a real click does, without depending on where a moving shark
	 * happens to be.
	 */
	await page.getByRole('button', { name: 'Pause' }).click();
	const tank = tile(page, 2).getByRole('img', { name: /tank/i });
	// mouse.click() takes VIEWPORT coordinates and, unlike locator.click(), does not scroll for you.
	// This tile sits below the fold at the default viewport, so the canvas has to be brought up first
	// or the click lands outside the window entirely and picks nothing.
	await tank.scrollIntoViewIfNeeded();

	const candidates = await tank.evaluate((el: HTMLCanvasElement) => {
		const { data, width, height } = el.getContext('2d')!.getImageData(0, 0, el.width, el.height);

		const red: { x: number; y: number }[] = [];
		for (let i = 0; i < data.length; i += 4) {
			const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
			if (r > 170 && g < 130 && b < 120) {
				const pixel = i / 4;
				red.push({ x: pixel % width, y: Math.floor(pixel / width) });
			}
		}

		// Group the red pixels, because the sharks are not the only red things: a fish that was just
		// eaten leaves a catch-burst, and paused, that burst hangs there forever. Cluster them and try
		// the biggest blobs first — a shark's body is a lot more red pixels than a burst's thin ring.
		const clusters: { x: number; y: number }[][] = [];
		for (const pixel of red) {
			const near = clusters.find((c) => Math.hypot(c[0].x - pixel.x, c[0].y - pixel.y) < 40);
			if (near) near.push(pixel);
			else clusters.push([pixel]);
		}

		const box = el.getBoundingClientRect();
		return clusters
			.sort((a, b) => b.length - a.length)
			.slice(0, 5)
			.map((cluster) => ({
				// the BODY, not the first pixel of it: picking works from a creature's centre
				x:
					box.left +
					(cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length) * (el.clientWidth / width),
				y:
					box.top +
					(cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length) * (el.clientHeight / height)
			}));
	});

	expect(
		candidates.length,
		'nothing red in the tank at all — where are the sharks?'
	).toBeGreaterThan(0);

	const panel = page.getByRole('dialog', { name: /Shark/ });
	for (const candidate of candidates) {
		await page.mouse.click(candidate.x, candidate.y);
		if (await panel.isVisible()) break;
	}

	await expect(panel).toBeVisible();
	await expect(panel).toContainText('no brain — deliberately');
	await expect(panel).toContainText('coevolutionary arms race');
});

test('Esc closes the inspector', async ({ page }) => {
	await tile(page, 2).getByRole('button', { name: '★ Champion' }).click();
	await expect(inspector(page)).toBeVisible();

	await page.keyboard.press('Escape');

	await expect(inspector(page)).toBeHidden();
});
