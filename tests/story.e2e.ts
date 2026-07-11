import { expect, test, type Page } from '@playwright/test';

/**
 * The Phase 8 gate: the bench told as a film, driven in the real app.
 *
 * The gate for this phase is a presentation one — the tour has to run itself, end where it should,
 * and be steerable from the keyboard by someone standing in front of a room. Everything on screen is
 * still the live simulation: the fish are a fresh generation of that world's evolved brains, and you
 * can stop the film, click one, and read its mind.
 */

const story = (page: Page) => page.getByRole('region', { name: 'story mode' });
const caption = (page: Page) => story(page).locator('h1');
const counter = (page: Page) => story(page).getByText(/scene \d+ of \d+/i);

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	// The prewarm must LAND before the film rolls: `toBeHidden` also passes for an element that has
	// not been rendered yet, so wait for the pill to appear first. (That trap cost me a debugging
	// session — the story opened over a bench that was still at generation 3.)
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	await expect(page.getByTestId('turbo')).toBeVisible();
	await expect(page.getByTestId('turbo')).toBeHidden({ timeout: 90_000 });

	await page.getByRole('button', { name: 'Play story' }).click();
	await expect(story(page)).toBeVisible();
});

test('opens on the first scene: the world that was given nothing', async ({ page }) => {
	await expect(caption(page)).toHaveText('Blind drift');
	await expect(counter(page)).toContainText('scene 1 of 5');

	// the fish are the world's evolved brains, a full fresh generation of them, not the survivors
	await expect(story(page).getByTestId('story-alive')).toHaveText('20');
	await expect(story(page)).toContainText('Gen 15'); // …bred to the generation the bench reached
});

test('the rail tags the sense each scene ADDS — the reason the scenes are in this order', async ({
	page
}) => {
	const rail = story(page).getByText('Brain inputs this world').locator('..');

	await expect(rail.getByText('new')).toHaveCount(0); // scene 1 adds nothing; it IS the nothing

	await page.getByRole('button', { name: 'scene 3' }).click();
	await expect(caption(page)).toHaveText('Direction');
	// exactly one sense is new here, and it is the one the whole product is about
	await expect(rail.getByText('new')).toHaveCount(1);
	await expect(rail.getByText('Direction').locator('..')).toContainText('new');
});

test('THE TOUR: it auto-advances through every scene and ends PAUSED on the last', async ({
	page
}) => {
	// Five scenes of 18 sim-seconds each, at 2×, is ~45 real seconds of film. That is the point of
	// the phase — it has to run itself unattended — so the test gets the time to sit and watch it.
	test.setTimeout(150_000);

	// 18 sim-seconds a scene × 5 scenes: run it at 2× so the tour is watchable inside a test. The
	// film's own speed control, not the bench's behind it — both exist, and both say "2×".
	await story(page).getByRole('radio', { name: '2×' }).click();

	for (const [index, name] of [
		[2, 'Distance'],
		[3, 'Direction'],
		[4, 'Anticipation'],
		[5, 'Corner-wise']
	] as const) {
		await expect(counter(page)).toContainText(`scene ${index} of 5`, { timeout: 60_000 });
		await expect(caption(page)).toHaveText(name);
	}

	// it holds the final image rather than looping back or going black
	await expect(story(page).getByRole('button', { name: 'play story' })).toBeVisible({
		timeout: 60_000
	});
	await expect(counter(page)).toContainText('scene 5 of 5');
});

test('the keyboard is the transport: arrows move, Space holds, Esc leaves', async ({ page }) => {
	await page.keyboard.press('ArrowRight');
	await expect(caption(page)).toHaveText('Distance');

	await page.keyboard.press('ArrowLeft');
	await expect(caption(page)).toHaveText('Blind drift');

	await page.keyboard.press(' ');
	await expect(story(page).getByRole('button', { name: 'play story' })).toBeVisible(); // held

	await page.keyboard.press('Escape');
	await expect(story(page)).toBeHidden();
	await expect(page.locator('section[aria-label^="world"]')).toHaveCount(5); // back on the bench
});

test('a segment is a jump: the progress bar is the table of contents', async ({ page }) => {
	await page.getByRole('button', { name: 'scene 5' }).click();

	await expect(caption(page)).toHaveText('Corner-wise');
	await expect(story(page).getByRole('button', { name: 'next scene' })).toBeDisabled();
});

test('nothing here is a recording: a fish can be stopped and read mid-scene', async ({ page }) => {
	await page.getByRole('button', { name: 'pause story' }).click();

	const tank = story(page).getByRole('img', { name: /tank/i });
	const box = (await tank.boundingBox())!;

	// find a fish by its colour and click it — the same pickCreature path a presenter's click takes
	const fish = await tank.evaluate((el: HTMLCanvasElement) => {
		const { data, width, height } = el.getContext('2d')!.getImageData(0, 0, el.width, el.height);
		for (let i = 0; i < data.length; i += 4) {
			const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
			if (b > 150 && r < 110 && g < 110) {
				const pixel = i / 4;
				return {
					x: (pixel % width) / (width / el.clientWidth),
					y: Math.floor(pixel / width) / (height / el.clientHeight)
				};
			}
		}
		return null;
	});
	expect(fish, 'no fish found in the tank').not.toBeNull();

	await page.mouse.click(box.x + fish!.x, box.y + fish!.y);

	const inspector = page.getByRole('dialog', { name: /Fish mind/ });
	await expect(inspector).toBeVisible();
	await expect(inspector).toContainText('68 genes'); // a real evolved brain, inside the film
});
