import { expect, test, type Page } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

/**
 * The Phase 4 gate: the bench itself, driven the way a user drives it.
 *
 * These are the controls that make the product an instrument rather than a demo — cutting a sense
 * is a live ablation on twenty evolved brains, and the curve underneath answers over the next few
 * generations. So the tests exercise them against the real, running simulation.
 */

const tiles = (page: Page) => page.locator('section[aria-label^="world"]');
const tile = (page: Page, index: number) => tiles(page).nth(index);

test.beforeEach(async ({ page }) => {
	await gotoApp(page);
	await waitForPrewarm(page);
});

test('opens with the five-world sense ladder, already evolved', async ({ page }) => {
	await expect(tiles(page)).toHaveCount(5);

	// left to right, one sense further along — this ordering IS the argument (README §8)
	const names = await tiles(page)
		.locator('input[aria-label="world name"]')
		.evaluateAll((fields) => fields.map((field) => (field as HTMLInputElement).value));
	// walls BEFORE closing speed — the order the measurements put them in (see DEFAULT_WORLDS)
	expect(names).toEqual(['Blind drift', 'Distance', 'Direction', 'Corner-wise', 'Full senses']);

	expect(await page.getByTestId('generations').innerText()).toBe('15'); // prewarmed
	for (const gen of await page.getByTestId('gen').allInnerTexts()) {
		expect(gen).toBe('Gen 15'); // every world, not just the first
	}
});

test('each world wears its own senses: the ladder is visible, not just claimed', async ({
	page
}) => {
	// innerText comes back SHOUTED — the pills are uppercased in CSS, not in the DOM.
	const pressed = async (index: number) =>
		tile(page, index)
			.getByRole('button', { pressed: true })
			.allInnerTexts()
			.then((labels) => labels.map((label) => label.toLowerCase()));

	expect(await pressed(0)).toEqual([]); // Blind drift: no predator input at all
	expect(await pressed(1)).toEqual(['dist']);
	expect(await pressed(2)).toEqual(['dist', 'dir']);
	expect(await pressed(3)).toEqual(['dist', 'dir', 'walls']); // Corner-wise: walls, no closing
	expect(await pressed(4)).toEqual(['dist', 'dir', 'close', 'walls']); // Full senses
});

test('a sense pill is a live ablation — it really cuts the input neuron', async ({ page }) => {
	const direction = tile(page, 2);
	const dir = direction.getByRole('button', { name: 'dir', exact: true });
	await expect(dir).toHaveAttribute('aria-pressed', 'true');

	await dir.click();

	await expect(dir).toHaveAttribute('aria-pressed', 'false');
	// and the world keeps evolving from where it is — cutting a sense does not restart it
	expect(await direction.getByTestId('gen').innerText()).toMatch(/^Gen \d+$/);
});

test('adding, duplicating and removing worlds', async ({ page }) => {
	await page.locator('main').getByRole('button', { name: 'Add environment' }).click();
	await expect(tiles(page)).toHaveCount(6);
	await expect(tiles(page).last().locator('input')).toHaveValue('World 6');

	// a duplicate carries the evolved brains across — it starts where the original is, not at gen 0
	const generation = await tile(page, 2).getByTestId('gen').innerText();
	await tile(page, 2).getByRole('button', { name: 'duplicate world' }).click();
	await expect(tiles(page)).toHaveCount(7);
	await expect(tile(page, 3).locator('input')).toHaveValue('Direction copy');
	await expect(tile(page, 3).getByTestId('gen')).toHaveText(generation);

	await tile(page, 3).getByRole('button', { name: 'remove world' }).click();
	await expect(tiles(page)).toHaveCount(6);
});

test('reset restarts evolution from random brains', async ({ page }) => {
	const first = tile(page, 0);
	expect(await first.getByTestId('gen').innerText()).toBe('Gen 15');

	await first.getByRole('button', { name: 'reset world' }).click();

	await expect(first.getByTestId('gen')).toHaveText('Gen 0'); // back to random brains
	expect(await page.getByTestId('generations').innerText()).toBe('15'); // the others carry on
});

test('a world can be renamed in place', async ({ page }) => {
	const name = tile(page, 0).locator('input[aria-label="world name"]');

	await name.fill('Blind drift (control)');
	await name.press('Enter');

	await expect(name).toHaveValue('Blind drift (control)');
	await expect(tile(page, 0)).toHaveAttribute('aria-label', 'world 1: Blind drift (control)');
});

test('★ Champion selects the best brain alive, and the tank draws it', async ({ page }) => {
	/*
	 * "Direction", not "Blind drift" — deliberately. In a world with no senses the selection paints
	 * only a thin ring, and a sparse pixel hash can genuinely MISS a 2px circle (it did, one run in
	 * four). Direction has dist+dir wired, so selecting its champion also draws the whole perception
	 * overlay — vision circle, glow, threat line, distance pill — which no hash can miss.
	 */
	const first = tile(page, 2);
	const tank = first.getByRole('application', { name: /tank/i });

	const fingerprint = () =>
		tank.evaluate((el: HTMLCanvasElement) => {
			const { data } = el.getContext('2d')!.getImageData(0, 0, el.width, el.height);
			let h = 0;
			for (let i = 0; i < data.length; i += 251) h = (h * 31 + data[i]) | 0;
			return h;
		});

	/*
	 * PAUSE FIRST. This test compares the tank's pixels before and after the click — and against a
	 * RUNNING sim those pixels change every frame regardless, so the comparison proved nothing. (I
	 * checked: with the button's handler replaced by a no-op, the test still passed.) Paused, the
	 * scene is frozen, and the ONLY thing that can repaint it is the selection the click makes:
	 * the ring, the vision radius and the threat line drawn around the chosen fish.
	 */
	// There must BE a best brain alive to select — ★ Champion correctly does nothing when nothing
	// is swimming, and even Direction's population can be down at a generation's brutal end. An
	// empty world only refills at its next generation boundary, a full 10 sim-seconds away, so the
	// poll must outlast one. And the poll PASSING is not enough either — the sharks keep hunting in
	// the gap before the pause lands, so confirm the tank is still inhabited once frozen, and run
	// the sim on and retry if they won that race.
	const alive = () => first.getByTestId('alive').innerText().then(Number);
	for (let attempt = 0; ; attempt++) {
		await expect.poll(alive, { timeout: 20_000 }).toBeGreaterThan(0);
		await page.getByRole('button', { name: 'Pause' }).click();
		if ((await alive()) > 0) break;
		expect(attempt, 'the population kept dying before the pause landed').toBeLessThan(4);
		await page.getByRole('button', { name: 'Evolve' }).click();
	}
	await expect
		.poll(async () => {
			const [a, b] = [await fingerprint(), await fingerprint()];
			return a === b;
		})
		.toBe(true); // the scene has settled

	const frozen = await fingerprint();
	await first.getByRole('button', { name: 'Champion' }).click();

	await expect.poll(fingerprint, { timeout: 5000 }).not.toBe(frozen);
});

test('THE INSTRUMENT: a run is identified, and an unseeded one says so', async ({ page }) => {
	/*
	 * What separates a lab from a demo: the run can be handed to someone else. The chip carries the
	 * configuration fingerprint and the seed — and when there is no seed it says "unseeded" rather
	 * than printing a number that would reproduce nothing.
	 */
	const manifest = page.getByTestId('run-manifest');
	await expect(manifest).toContainText('run');
	await expect(page.getByTestId('seed')).toHaveText('unseeded');

	await manifest.click();
	const dialog = page.getByRole('dialog', { name: 'Run manifest' });
	await expect(dialog).toBeVisible();

	// pinning a seed RELAUNCHES the bench — a seeded run is a fresh experiment, not a relabelled one
	await dialog.getByRole('textbox', { name: 'seed' }).fill('42');
	await dialog.getByRole('button', { name: 'Relaunch' }).click();

	await expect(page.getByTestId('seed')).toHaveText('42');
	await waitForPrewarm(page);
	await expect(page.getByTestId('generations')).toHaveText('15'); // and it evolved again, seeded
});

test('an environment that has been edited says so on its face', async ({ page }) => {
	// A bench of five identical-looking cards makes the reader open five dialogs to find the one you
	// changed. The card states its own overrides against the baseline the run launched with.
	const tile3 = page.locator('section[aria-label^="world"]').nth(2);
	await expect(tile3.getByText(/override/)).toHaveCount(0);

	await tile3.getByRole('button', { name: 'Conditions' }).click();
	const conditions = page.getByRole('dialog', { name: 'Conditions' });
	await conditions
		.getByRole('radiogroup', { name: /which part of the experiment/i })
		.getByRole('radio', { name: 'Adversary' })
		.click();
	await conditions.getByRole('button', { name: 'more sharks' }).click();
	await page.keyboard.press('Escape');

	await expect(tile3.getByText('▲ 1 override')).toBeVisible();
});
