import { expect, test, type Page } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

/**
 * The bench's shape: cards are SIZED, not stretched, and the layout follows the experiment.
 *
 * This exists because the first version of it shipped broken and looked fine in a unit test. The
 * "+ Add environment" slot spanned every column, and `auto-fit` only collapses a track that nothing
 * occupies — so a bench of one painted its single card in a 380px track and left the rest of the row
 * empty, while claiming (in CSS, in a comment) to give that card the room. Nothing caught it but the
 * owner's eyes.
 *
 * So the assertions here are about PIXELS, and they are relative ones: a card gets wider as the
 * bench empties, the row stays centred, and three is the ceiling. Absolute widths would only pin the
 * viewport this suite happens to run at.
 */

const cards = (page: Page) => page.locator('section[aria-label^="world"]');

/** The empty slot. Scoped to the bench: the sidebar has an "Add environment" button of its own. */
const slot = (page: Page) => page.locator('main').getByRole('button', { name: 'Add environment' });

/** The card's real, rendered box — the thing the owner was looking at. */
async function cardBox(page: Page, index = 0) {
	const box = await cards(page).nth(index).boundingBox();
	return box!;
}

/**
 * How much empty bench sits either side of the row of cards.
 *
 * Measured against the bench COLUMN (main's parent), which is all the room the cards have to play
 * with. Measuring against `main` would prove nothing: main is the capped, centred measure itself, so
 * a card that filled it would report margins of zero whether or not the row was centred on screen.
 */
async function margins(page: Page) {
	const boxes = await Promise.all(
		Array.from({ length: await cards(page).count() }, (_, i) => cardBox(page, i))
	);

	// The FIRST ROW only. Comparing the first card to the last one measures the ragged end of row two
	// on any bench that has a row two, and reports a wildly off-centre layout that is perfectly
	// centred. (It did. That was this helper's bug, not the grid's.)
	const top = Math.min(...boxes.map((b) => b.y));
	const row = boxes.filter((b) => b.y === top);
	const bench = (await page.locator('main').locator('..').boundingBox())!;

	return {
		left: Math.min(...row.map((b) => b.x)) - bench.x,
		right: bench.x + bench.width - Math.max(...row.map((b) => b.x + b.width))
	};
}

async function removeWorldsDownTo(page: Page, remaining: number) {
	while ((await cards(page).count()) > remaining) {
		await page.getByRole('button', { name: 'remove world' }).last().click();
	}
	await expect(cards(page)).toHaveCount(remaining);
}

test.beforeEach(async ({ page }) => {
	await gotoApp(page);
	await waitForPrewarm(page);
});

test('a bench of one is ONE BIG CARD, centred — not a card in the corner', async ({ page }) => {
	const crowded = await cardBox(page, 0); // five worlds, three across

	await removeWorldsDownTo(page, 1);

	const alone = await cardBox(page, 0);
	expect(alone.width).toBeGreaterThan(crowded.width * 1.5); // it really did take the room

	// …and it is in the middle of the bench, not hugging the left edge (the bug, exactly).
	const { left, right } = await margins(page);
	expect(Math.abs(left - right)).toBeLessThan(2);
	expect(left).toBeGreaterThan(20);
});

test('two worlds fill the two-card measure between them', async ({ page }) => {
	await removeWorldsDownTo(page, 2);

	const first = await cardBox(page, 0);
	const second = await cardBox(page, 1);

	expect(Math.round(first.width)).toBe(Math.round(second.width)); // equal halves
	// Side by side, not stacked, and not two narrow cards adrift in a wide row.
	expect(second.y).toBe(first.y);
	const { left, right } = await margins(page);
	expect(Math.abs(left - right)).toBeLessThan(2);
});

test('the empty slot never takes a column from the cards', async ({ page }) => {
	// The regression itself: as a full-width grid cell, this button held every track open.
	await removeWorldsDownTo(page, 1);

	const card = await cardBox(page, 0);
	const empty = (await slot(page).boundingBox())!;

	expect(empty.y).toBeGreaterThan(card.y + card.height / 2); // below the card, not beside it
	expect(Math.round(empty.width)).toBe(Math.round(card.width)); // and on the same measure
});

/*
 * Three across only HAPPENS on a bench wide enough to hold three cards at their minimum. The default
 * viewport is not (the sidebar takes its share, and a card never squeezes below 380px — it drops a
 * column instead), so the ceiling has to be tested on a screen that could actually break it.
 */
test.describe('on a wide screen', () => {
	test.use({ viewport: { width: 1760, height: 1000 } });

	test('three is the ceiling: a fourth world starts a new row', async ({ page }) => {
		const first = await cardBox(page, 0);
		const third = await cardBox(page, 2);
		const fourth = await cardBox(page, 3);

		expect(third.y).toBe(first.y); // three across…
		expect(fourth.y).toBeGreaterThan(first.y + first.height / 2); // …and the fourth is underneath

		// The cards do not divide the monitor between them: they stop, and the bench centres them.
		const { left, right } = await margins(page);
		expect(left).toBeGreaterThan(20);
		expect(Math.abs(left - right)).toBeLessThan(2);
	});
});
