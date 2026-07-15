import { expect, test, type Page } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

/**
 * The Phase 8 gate: the bench told as a film, driven in the real app.
 *
 * The gate for this phase is a presentation one — the tour has to run itself, end where it should,
 * and be steerable from the keyboard by someone standing in front of a room. Everything on screen is
 * still the live simulation: the fish are a fresh generation of that world's evolved brains, and you
 * can stop the film, click one, and read its mind.
 */

const story = (page: Page) => page.getByRole('dialog', { name: 'story mode' });
const caption = (page: Page) => story(page).locator('h1');
const counter = (page: Page) => story(page).getByText(/scene \d+ of \d+/i);

test.beforeEach(async ({ page }) => {
	await gotoApp(page);
	// The prewarm must LAND before the film rolls. (The trap cost a debugging session once — the
	// story opened over a bench that was still at generation 3.)
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	await waitForPrewarm(page);

	await page.getByRole('button', { name: 'Play story' }).click();
	await expect(story(page)).toBeVisible();
});

test('opens on the first scene: the world that was given nothing', async ({ page }) => {
	await expect(caption(page)).toHaveText('Blind drift');
	await expect(counter(page)).toContainText('scene 1 of 5');

	// The fish are the world's evolved brains — a full FRESH generation of them, not the handful of
	// survivors the bench had. Not an exact 20, though: the sharks start hunting on frame one, and
	// racing them for an exact count is how this test flaked. The claim is "a full tank, not the
	// remains of one", and the bench's Blind drift is typically down to a third by now.
	await expect(story(page).getByTestId('story-alive')).toHaveText(/^(1[89]|20)$/);
	await expect(story(page)).toContainText('/ 20'); // …out of the full generation
	// …bred to AT LEAST the generation the prewarm reached (15). Not an exact 15: Blind drift's
	// population collapses, and a generation ends the instant its last fish is eaten — so by the time
	// the film rolls this world may already have churned a generation or two past the prewarm target.
	// A slow CI runner made that visible; the claim is "the bench's real generation, not gen 0".
	await expect(story(page)).toContainText(/Gen (1[5-9]|[2-9]\d)/);
});

test('the rail tags the sense each scene ADDS — the reason the scenes are in this order', async ({
	page
}) => {
	const rail = story(page).getByText('Brain inputs this world').locator('..');
	// `exact` matters: each row also carries a screen-reader line ("wired in, new this scene") that
	// contains the word, and an unscoped match would count it too.
	const tags = rail.getByText('new', { exact: true });

	await expect(tags).toHaveCount(0); // scene 1 adds nothing; it IS the nothing

	await page.getByRole('button', { name: 'scene 3' }).click();
	await expect(caption(page)).toHaveText('Direction');
	// exactly one sense is new here, and it is the one the whole product is about
	await expect(tags).toHaveCount(1);
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
		[4, 'Corner-wise'],
		[5, 'Full senses']
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

test('the arrows belong to the speed control while it has focus — the film must not jump', async ({
	page
}) => {
	// A presenter changing pace with the arrow keys must not have the scene skip out from under
	// them. The radio group owns its arrows; the film only takes them when nothing else wants them.
	const speed = story(page).getByRole('radio', { name: '1×' });
	await speed.click();
	await expect(caption(page)).toHaveText('Blind drift');

	await page.keyboard.press('ArrowRight');

	await expect(story(page).getByRole('radio', { name: '2×' })).toBeChecked(); // the speed moved…
	await expect(caption(page)).toHaveText('Blind drift'); // …and the film did not
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

test('the takeover TAKES focus — or Space would re-cut the film under the presenter', async ({
	page
}) => {
	/*
	 * The bug this guards was worse than "the key does nothing". Focus stayed on the "Play story"
	 * button in the top bar, now hidden behind a full-screen film — so Space pressed THAT button
	 * again and restarted the story from scene one, mid-presentation.
	 */
	const focused = () =>
		page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
	expect(await focused()).toBe('story mode');

	// NOT locator.press(): that FOCUSES its target before pressing, which would hand the film the
	// focus the test is trying to prove it already has. Press the key at the page.
	await page.keyboard.press(' ');
	await expect(story(page).getByRole('button', { name: 'play story' })).toBeVisible(); // held

	// and leaving hands focus back to where it came from
	await page.keyboard.press('Escape');
	await expect(story(page)).toBeHidden();
	expect(await focused()).toBe('');
	await expect(page.getByRole('button', { name: 'Play story' })).toBeFocused();
});

test('the bench behind the film is INERT — Tab cannot reach a control nobody can see', async ({
	page
}) => {
	/*
	 * Without this, a keyboard user tabbing during a film walks straight into the bench hidden behind
	 * it — and Enter on an invisible "remove world" button removes a world, mid-presentation, with no
	 * way to see it happen.
	 */
	const reachable: string[] = [];
	for (let i = 0; i < 25; i++) {
		await page.keyboard.press('Tab');
		reachable.push(
			await page.evaluate(() => {
				const el = document.activeElement as HTMLElement | null;
				if (!el || el === document.body) return 'body';
				return el.closest('[aria-label="story mode"]') ? 'film' : 'BENCH';
			})
		);
	}

	expect(reachable, 'focus escaped the film into the bench behind it').not.toContain('BENCH');
	expect(reachable, 'nothing in the film is tabbable at all').toContain('film');
});

test('a segment is a jump: the progress bar is the table of contents', async ({ page }) => {
	await page.getByRole('button', { name: 'scene 5' }).click();

	await expect(caption(page)).toHaveText('Full senses');
	await expect(story(page).getByRole('button', { name: 'next scene' })).toBeDisabled();
});

test('nothing here is a recording: a fish can be stopped and read mid-scene', async ({ page }) => {
	await page.getByRole('button', { name: 'pause story' }).click();

	const tank = story(page).getByRole('application', { name: /tank/i });
	const box = (await tank.boundingBox())!;

	// Find a fish by its colour and click it — the same pickCreature path a presenter's click takes.
	//
	// POLLED, not scanned once: the stage paints on the sim loop, and a single scan taken before the
	// scene's first frame lands finds an empty canvas and reports "no fish in the tank" — which is a
	// lie about the product and a truth about the test's timing. It only ever bit under a loaded
	// suite, which is exactly when a flake is least welcome.
	const findFish = () =>
		tank.evaluate((el: HTMLCanvasElement) => {
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

	await expect.poll(async () => (await findFish()) !== null, { timeout: 15_000 }).toBe(true); // the scene has painted, and there are fish in it
	const fish = await findFish();
	expect(fish, 'no fish found in the tank').not.toBeNull();

	await page.mouse.click(box.x + fish!.x, box.y + fish!.y);

	const inspector = page.getByRole('dialog', { name: /Fish mind/ });
	await expect(inspector).toBeVisible();
	await expect(inspector).toContainText('what it does at every shark position'); // opens on the escape map by default
	await inspector.getByRole('radio', { name: 'Wiring' }).click();
	await expect(inspector).toContainText('68 genes'); // a real evolved brain, inside the film
});
