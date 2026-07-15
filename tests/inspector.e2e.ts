import { expect, test, type Page } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

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
	await gotoApp(page);
	await waitForPrewarm(page);
});

test('★ Champion opens a live mind, and the bench keeps running behind it', async ({ page }) => {
	await tile(page, 4).getByRole('button', { name: 'Champion' }).click(); // "Full senses"

	await expect(inspector(page)).toBeVisible();
	await expect(inspector(page)).toContainText('one real evolved brain in “Full senses”');
	// It opens on the readable policy — the escape map — by default...
	await expect(inspector(page)).toContainText('what it does at every shark position');
	// ...and this fish's real 68 weights are one toggle away.
	await inspector(page).getByRole('radio', { name: 'Wiring' }).click();
	await expect(inspector(page)).toContainText('68 genes');

	// NOT a modal: you inspect a brain while watching it swim, so the bench behind stays live and
	// clickable — the Conditions button on another tile still works.
	expect(await inspector(page).evaluate((el) => el.matches(':modal'))).toBe(false);
	await tile(page, 0).getByRole('button', { name: 'Conditions' }).click();
	await expect(page.getByRole('dialog', { name: 'Conditions' })).toBeVisible();
});

test('the panel is alive: the numbers move because the fish is thinking', async ({ page }) => {
	await tile(page, 4).getByRole('button', { name: 'Champion' }).click();

	const lived = () =>
		inspector(page)
			.getByLabel('lived')
			.innerText()
			.then((text) => Number(text.replace('s', '')));

	const before = await lived();
	await expect.poll(lived, { timeout: 5000 }).toBeGreaterThan(before); // it is surviving, live
});

test('ABLATION: cutting the closing-speed neuron really changes the brain', async ({ page }) => {
	await tile(page, 4).getByRole('button', { name: 'Champion' }).click(); // Full senses — the only world with closing speed on
	await expect(inspector(page)).toContainText('closing speed');

	// The fingerprint reads the WIRING view, so switch to it (the panel opens on the escape map).
	await inspector(page).getByRole('radio', { name: 'Wiring' }).click();

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

	await inspector(page).getByRole('button', { name: 'Ablate: cut closing speed' }).click();

	// the input node dims and its edges go dead — the picture must change
	await expect.poll(() => brainprint(page), { timeout: 5000 }).not.toBe(wired);
	// the CLOSING bar now says the neuron is gone, not that the threat is (walls is already off in
	// this world, so an unscoped "off" would match either bar and prove nothing)
	await expect(inspector(page).getByRole('status', { name: 'closing speed' })).toHaveText('off');
	// and it is the same live ablation the tile performs: the tile's pill agrees
	await expect(tile(page, 4).getByRole('button', { name: 'close', exact: true })).toHaveAttribute(
		'aria-pressed',
		'false'
	);

	// and it heals back
	await inspector(page).getByRole('button', { name: 'Restore closing speed' }).click();
	await expect(tile(page, 4).getByRole('button', { name: 'close', exact: true })).toHaveAttribute(
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
		// index 3 is Corner-wise, which adds WALLS: more inputs, but none of them carries the
		// future, so it stays on the integration rung. Only closing speed does.
		[3, 'rung 2 · sensor integration'],
		[4, 'rung 3 · prediction'] // Full senses: closing speed carries where the threat WILL be
	] as const;

	for (const [index, reads] of rungs) {
		await tile(page, index).getByRole('button', { name: 'Champion' }).click();
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
	const tank = tile(page, 2).getByRole('application', { name: /tank/i });
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
	await expect(panel).toContainText('no brain, deliberately');
	await expect(panel).toContainText('coevolutionary arms race');
});

test('the bench outlives a watched fish: it dies, the drawer closes, and the sim keeps running', async ({
	page
}) => {
	/*
	 * The freeze this pins down: a HAND-PICKED selection is released inside the tick where its
	 * fish stops existing (eaten, or its generation turns) — and that same tick paints, one
	 * flush before the inspector unmounts. The brain painter once read the already-undefined
	 * selection lookup there, threw, and killed the sim loop's timer chain: page alive, every
	 * tank frozen. So: watch a fish by hand, let nature take it, and demand both silence in the
	 * console and a bench that is still moving afterwards.
	 */
	// This one test waits on the SIMULATION's clock, not the wall's (see the note below), so it gets a
	// budget the 30s default cannot give it. Raised here rather than in the config: every other test
	// in the suite should still fail fast, and a global bump would hide a real hang in any of them.
	test.setTimeout(90_000);

	const frameErrors: string[] = [];
	page.on('pageerror', (error) => frameErrors.push(String(error)));

	// A keyboard walk is a hand-picked selection — released on death, not swapped for an heir.
	const tank = tile(page, 0).getByRole('application');
	await tank.scrollIntoViewIfNeeded();
	await tank.click({ position: { x: 8, y: 8 } }); // corner = water: focuses without picking
	await page.keyboard.press('ArrowRight');
	await expect(inspector(page)).toBeVisible();

	/*
	 * Hold the selection until the fish stops existing. Sharks hunt from frame one and a training
	 * generation lasts 10 SIM-seconds, so one of the two release paths — eaten, or generation
	 * turnover — is guaranteed. Both run through the crash tick, which is the point.
	 *
	 * The window is generous because it is wall-clock time spent waiting on SIM time, and the two are
	 * not the same clock: the loop advances the simulation as fast as the machine lets it, so a
	 * contended CI box (several Playwright workers, software rendering, five live tanks) can take two
	 * or three wall-seconds to buy one sim-second. At 20s this passed locally in 8–24s and failed on
	 * CI — a test that was really measuring the runner's spare CPU. 60s bounds the SLOWEST honest run
	 * without ever passing a bench that has genuinely frozen: a frozen bench never releases at all.
	 */
	await expect(inspector(page)).toBeHidden({ timeout: 60_000 });

	expect(frameErrors, 'a frame threw when the watched fish stopped existing').toEqual([]);

	// And the water is still moving — the original bug did not throw twice, it froze EVERYTHING:
	// the loop died with the throw and no tank ever painted again.
	const waterprint = () =>
		tank.evaluate((el: HTMLCanvasElement) => {
			const { data } = el.getContext('2d')!.getImageData(0, 0, el.width, el.height);
			let h = 0;
			for (let i = 0; i < data.length; i += 397) h = (h * 31 + data[i]) | 0;
			return h;
		});
	const before = await waterprint();
	await expect.poll(waterprint, { timeout: 5000 }).not.toBe(before);
});

test('Esc closes the inspector', async ({ page }) => {
	await tile(page, 2).getByRole('button', { name: 'Champion' }).click();
	await expect(inspector(page)).toBeVisible();

	await page.keyboard.press('Escape');

	await expect(inspector(page)).toBeHidden();
});
