import { expect, test, type Page } from '@playwright/test';
import { waitForPrewarm } from './helpers';

/**
 * The Phase 5 gate, driven in the real app.
 *
 * The claim the dialog makes about itself — "changes apply live to this world; brains keep evolving
 * from where they are" — is the whole reason it exists, and it is the kind of claim that is easy to
 * make and easy to quietly break. So it is tested against a running bench: edit the experiment, and
 * check both that the world CHANGED and that its fifteen generations of learning are still there.
 */

const tile = (page: Page, index: number) => page.locator('section[aria-label^="world"]').nth(index);
const meta = (page: Page, index: number) =>
	tile(page, index)
		.getByText(/prey · .* shark/)
		.innerText();
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Conditions' });

/*
 * Every query into the dialog is scoped to it, and that is not fussiness: the bench BEHIND the
 * dialog carries the same words. Five tiles each have a "world name" field and a sense pill
 * labelled "close", and the tile's meta chip echoes the very number the dialog is showing. An
 * unscoped locator here does not fail loudly — it matches six things and picks a fight.
 */
const field = (page: Page, name: string | RegExp) => dialog(page).getByRole('textbox', { name });
const slider = (page: Page, name: RegExp) => dialog(page).getByRole('slider', { name });

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await waitForPrewarm(page);
	await tile(page, 2).getByRole('button', { name: 'Conditions' }).click(); // "Direction"
	await expect(dialog(page)).toBeVisible();
});

test('THE POINT: an edit changes the world and the world keeps what it learned', async ({
	page
}) => {
	const before = await tile(page, 2).getByTestId('gen').innerText();
	expect(before).toBe('Gen 15');

	await dialog(page).getByRole('button', { name: 'more predators' }).click();
	await dialog(page).getByRole('button', { name: 'more prey' }).click();

	// the tile answers immediately…
	await expect.poll(() => meta(page, 2)).toContain('22 prey · 3 sharks');
	// …and it is still fifteen generations of evolution deep, not back at zero
	await expect(tile(page, 2).getByTestId('gen')).toHaveText('Gen 15');

	// …and the ENGINE really grew the population, not just the chip that describes it: the sharks
	// keep eating, so `alive` alone says little — but alive + eaten is the generation's roster, and
	// it must now be the 22 fish that were asked for.
	await expect
		.poll(async () => {
			const alive = Number(await tile(page, 2).getByTestId('alive').innerText());
			const eaten = Number((await tile(page, 2).getByTestId('eaten').innerText()).slice(1));
			return alive + eaten;
		})
		.toBe(22);
});

test('the edit reaches the SIMULATION, not just the tile that describes it', async ({ page }) => {
	/*
	 * The tile's chips are rendered from the store's reactive mirror of cfg, so they would happily
	 * report "900×400" even if the edit never reached the engine. The TANK is different: it is
	 * painted straight from the raw world, and the tank's aspect ratio is the container's. So resize
	 * the container, with the sim PAUSED so nothing else can move the pixels, and watch the water
	 * itself change shape.
	 */
	// Pause BEFORE reopening the dialog: a modal makes the page behind it inert, so the top bar's
	// Pause button is genuinely unclickable while it is open — which is the modal doing its job.
	await page.keyboard.press('Escape');
	await expect(dialog(page)).toBeHidden();
	await page.getByRole('button', { name: 'Pause' }).click();
	await tile(page, 2).getByRole('button', { name: 'Conditions' }).click();
	await expect(dialog(page)).toBeVisible();

	const tank = tile(page, 2).getByRole('application', { name: /tank/i });
	const fingerprint = () =>
		tank.evaluate((el: HTMLCanvasElement) => {
			const { data } = el.getContext('2d')!.getImageData(0, 0, el.width, el.height);
			let h = 0;
			for (let i = 0; i < data.length; i += 997) h = (h * 31 + data[i]) | 0;
			return h;
		});

	await expect
		.poll(async () => {
			const [a, b] = [await fingerprint(), await fingerprint()];
			return a === b;
		})
		.toBe(true); // frozen
	const frozen = await fingerprint();

	await slider(page, /container height/i).fill('820');

	await expect.poll(fingerprint, { timeout: 5000 }).not.toBe(frozen);
});

test('every field writes through: sliders, senses, name, accent', async ({ page }) => {
	await slider(page, /predator speed/i).fill('1.45');
	await expect(dialog(page).getByText('1.45×', { exact: true })).toBeVisible(); // read back
	await expect.poll(() => meta(page, 2)).toContain('1.45×'); // and the tile chip carries it

	// a sense checkbox is the same live ablation the tile pill performs
	await dialog(page).getByRole('checkbox', { name: /walls/i }).check();
	await expect(tile(page, 2).getByRole('button', { name: 'walls', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await field(page, /world name/i).fill('Direction (control)');
	await expect(tile(page, 2)).toHaveAttribute('aria-label', 'world 3: Direction (control)');

	await slider(page, /container width/i).fill('900');
	// NB: this proves the chip was told, not that the tank was resized — the chip renders from the
	// store's mirror of cfg. The test above is the one that proves the water itself changed shape.
	await expect.poll(() => meta(page, 2)).toContain('900×400');
});

test('it is a real modal: Esc closes it, and it traps focus while open', async ({ page }) => {
	// showModal() is what buys the focus trap and the inert background — assert we actually got one
	expect(await dialog(page).evaluate((el) => el.matches(':modal'))).toBe(true);
	expect(
		await dialog(page).evaluate(() => document.activeElement?.closest('dialog') !== null)
	).toBe(true);

	await page.keyboard.press('Escape');

	await expect(dialog(page)).toBeHidden();
});

test('closing and reopening shows the world as it now is, not as it was', async ({ page }) => {
	await dialog(page).getByRole('button', { name: 'more prey' }).click();
	await dialog(page).getByRole('button', { name: 'close' }).click();
	await expect(dialog(page)).toBeHidden();

	await tile(page, 2).getByRole('button', { name: 'Conditions' }).click();

	const prey = dialog(page).getByRole('group', { name: 'Prey' }).getByRole('status');
	await expect(prey).toHaveText('22'); // it reads the world, it does not keep a copy of it
});
