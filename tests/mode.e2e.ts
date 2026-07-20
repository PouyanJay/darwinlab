import { expect, test, type Page } from '@playwright/test';
import { gotoApp, waitForPrewarm } from './helpers';

/**
 * The top-level mode switch — Studio ⇄ Research.
 *
 * What a store unit test cannot reach: that the top-bar toggle really swaps the whole stage (the
 * lineage canvas gives way to the Research stage and back), that the choice survives a reload, and
 * that Studio's furniture does not float over Research.
 */

const modeGroup = (page: Page) => page.getByRole('radiogroup', { name: 'lab mode' });
const researchStage = (page: Page) => page.getByTestId('research-stage');

/**
 * Reload and re-enter the lab by hand. gotoApp's "recenter the tree" step is a Studio control that
 * would not exist if we reload into Research, so persistence tests re-enter through the intro
 * directly rather than through the helper.
 */
async function reenter(page: Page): Promise<void> {
	await page.reload();
	await expect(page.getByTestId('intro')).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('intro')).toBeHidden();
}

test('the top bar swaps Studio ⇄ Research, and the stage swaps with it', async ({ page }) => {
	await gotoApp(page);
	await waitForPrewarm(page);

	// Studio is where we start: the lineage tiles are in the water and Research is not on screen.
	await expect(modeGroup(page).getByRole('radio', { name: 'Studio' })).toBeChecked();
	await expect(page.locator('section.tile').first()).toBeVisible();
	await expect(researchStage(page)).toHaveCount(0);

	// Flip to Research: the Research stage takes the bench, the canvas tiles leave it entirely.
	await modeGroup(page).getByRole('radio', { name: 'Research' }).click();
	await expect(researchStage(page)).toBeVisible();
	await expect(page.locator('section.tile')).toHaveCount(0);

	// And back: the canvas returns, Research is gone.
	await modeGroup(page).getByRole('radio', { name: 'Studio' }).click();
	await expect(researchStage(page)).toHaveCount(0);
	await expect(page.locator('section.tile').first()).toBeVisible();
});

test('the mode survives a reload — into Research, and back out of it', async ({ page }) => {
	await gotoApp(page);
	await waitForPrewarm(page);

	// Entering Research and reloading lands us back in Research, not on the canvas.
	await modeGroup(page).getByRole('radio', { name: 'Research' }).click();
	await expect(researchStage(page)).toBeVisible();
	await reenter(page);
	await expect(researchStage(page)).toBeVisible();
	await expect(modeGroup(page).getByRole('radio', { name: 'Research' })).toBeChecked();

	// And LEAVING it persists too: back to Studio, reload, and we are not dumped back into Research.
	await modeGroup(page).getByRole('radio', { name: 'Studio' }).click();
	await expect(researchStage(page)).toHaveCount(0);
	await reenter(page);
	await expect(researchStage(page)).toHaveCount(0);
	await expect(modeGroup(page).getByRole('radio', { name: 'Studio' })).toBeChecked();
});
