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

test('the mode survives a reload', async ({ page }) => {
	await gotoApp(page);
	await waitForPrewarm(page);

	await modeGroup(page).getByRole('radio', { name: 'Research' }).click();
	await expect(researchStage(page)).toBeVisible();

	// Reload and re-enter the lab the way a user does. gotoApp's "recenter the tree" step is a Studio
	// control that would not exist here, so this test enters by hand rather than through the helper.
	await page.reload();
	await expect(page.getByTestId('intro')).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('intro')).toBeHidden();

	// We land back in Research, not on the canvas — the choice was remembered.
	await expect(researchStage(page)).toBeVisible();
	await expect(modeGroup(page).getByRole('radio', { name: 'Research' })).toBeChecked();
});
