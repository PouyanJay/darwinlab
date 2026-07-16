import { expect, test, type Page } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

/**
 * The lineage canvas: worlds are draggable nodes on a pannable, zoomable plane, and branching wires a
 * child to its parent with a real edge. This replaced the old sized-and-centred grid.
 *
 * The assertions are about what actually MOVED or got WIRED, not about pixels a running sim happens to
 * paint. A node's position is view state, so its on-screen box is stable frame to frame — which is
 * exactly what lets us prove a drag moved the node it grabbed and left its neighbour alone, and that a
 * branch drew a wire that was not there before.
 */

const nodes = (page: Page) => page.locator('section[aria-label^="world"]');
const node = (page: Page, index: number) => nodes(page).nth(index);
const edges = (page: Page) => page.locator('svg.edges path');
const zoomReadout = (page: Page) => page.locator('.zoom-readout');

async function box(page: Page, index: number) {
	return (await node(page, index).boundingBox())!;
}

test.beforeEach(async ({ page }) => {
	await gotoApp(page);
	await waitForPrewarm(page);
});

test('a fresh bench has no wires — the roots are unbranched', async ({ page }) => {
	await expect(nodes(page)).toHaveCount(5);
	await expect(edges(page)).toHaveCount(0);
});

test('branching wires a child BELOW its parent — an edge that was not there before', async ({
	page
}) => {
	const parent = await box(page, 0); // Blind drift
	const parentGen = await node(page, 0).getByTestId('gen').innerText();

	await node(page, 0).getByRole('button', { name: 'Branch' }).click();
	// the branch drops you into the child's Conditions to change one thing; close it to read the tree
	await expect(page.getByRole('dialog', { name: 'Conditions' })).toBeVisible();
	await page.keyboard.press('Escape');

	// a sixth node, wired: the edge count went 0 → 1, and the child inherited the parent's generation
	await expect(nodes(page)).toHaveCount(6);
	await expect(edges(page)).toHaveCount(1);
	const child = nodes(page).last();
	await expect(child.locator('input')).toHaveValue('Blind drift ⑃');
	await expect(child.getByTestId('gen')).toHaveText(parentGen);

	// and it sits below the parent, which is what makes the wire read as "descends from"
	const childBox = (await child.boundingBox())!;
	expect(childBox.y).toBeGreaterThan(parent.y + parent.height / 2);
});

test('duplicate makes a free-standing copy — carries the brains, but no wire into the tree', async ({
	page
}) => {
	await expect(edges(page)).toHaveCount(0);

	await node(page, 0).getByRole('button', { name: 'duplicate world' }).click();

	// a sixth node inserted right after the source, with its brains — but the edge count stays 0,
	// which is the whole difference from Branch: a duplicate descends from nothing.
	await expect(nodes(page)).toHaveCount(6);
	await expect(edges(page)).toHaveCount(0);
	await expect(node(page, 1).locator('input')).toHaveValue('Blind drift copy');
});

test('a node is dragged by its header, and its neighbour stays put', async ({ page }) => {
	const before = await box(page, 1); // Distance
	const neighbourBefore = await box(page, 0); // Blind drift — must not move

	// grab the node's drag grip and pull it across the plane
	const grip = node(page, 1).locator('.grip');
	const grab = (await grip.boundingBox())!;
	const cx = grab.x + grab.width / 2;
	const cy = grab.y + grab.height / 2;
	await page.mouse.move(cx, cy);
	await page.mouse.down();
	await page.mouse.move(cx + 140, cy + 90, { steps: 8 });
	await page.mouse.up();

	const after = await box(page, 1);
	// it followed the cursor across the plane…
	expect(after.x - before.x).toBeGreaterThan(80);
	expect(after.y - before.y).toBeGreaterThan(45);
	// …and dragging one node is not panning the plane: the neighbour is exactly where it was.
	const neighbourAfter = await box(page, 0);
	expect(Math.abs(neighbourAfter.x - neighbourBefore.x)).toBeLessThan(2);
	expect(Math.abs(neighbourAfter.y - neighbourBefore.y)).toBeLessThan(2);
});

test('the zoom controls change the camera, and recenter frames the tree again', async ({
	page
}) => {
	const read = () =>
		zoomReadout(page)
			.innerText()
			.then((t) => parseInt(t, 10));
	const start = await read();

	await page.getByRole('button', { name: 'zoom in' }).click();
	await page.getByRole('button', { name: 'zoom in' }).click();
	expect(await read()).toBeGreaterThan(start); // zooming in really enlarged the camera

	// recenter fits all five roots back into the viewport — a definite, repeatable framing
	await page.getByRole('button', { name: 'recenter the tree' }).click();
	const framed = await read();
	// every root is inside the canvas after a fit
	const canvas = (await page.locator('.canvas').boundingBox())!;
	for (let i = 0; i < 5; i++) {
		const b = await box(page, i);
		expect(b.x).toBeGreaterThanOrEqual(canvas.x - 1);
		expect(b.x + b.width).toBeLessThanOrEqual(canvas.x + canvas.width + 1);
	}
	expect(framed).toBeGreaterThan(0);
});
