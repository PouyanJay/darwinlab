import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * The Studio→Research round-trip end to end: "Analyse" on a Studio world carries that world into
 * Research as the subject (a banner names it and every instrument runs on it), and "use a generic
 * world" drops it. The mirror direction — Research→Studio's "Watch this world" — is covered by
 * atlas.e2e; together they are the seam-dissolving pair.
 */

test('"Analyse" carries a Studio world into Research, and "use a generic world" drops it', async ({
	page
}) => {
	await gotoApp(page);

	// The world's own name, so we can prove the banner is about THIS world, not a placeholder.
	const tile = page.locator('section[aria-label^="world"]').first();
	const name = await tile.getByRole('textbox').first().inputValue();

	await tile.getByRole('button', { name: 'Analyse' }).click();

	// Landed in Research, on the subject of the clicked world.
	await expect(
		page.getByRole('radiogroup', { name: 'lab mode' }).getByRole('radio', { name: 'Research' })
	).toBeChecked();
	const banner = page.getByTestId('research-subject');
	await expect(banner).toContainText('Analysing');
	await expect(banner).toContainText(name);

	// Drop the subject — the banner goes, and we are still in Research (clearing the subject is not
	// leaving the mode), now exploring a generic world.
	await page.getByRole('button', { name: 'Use a generic world' }).click();
	await expect(page.getByTestId('research-subject')).toHaveCount(0);
	await expect(
		page.getByRole('radiogroup', { name: 'lab mode' }).getByRole('radio', { name: 'Research' })
	).toBeChecked();
});

test('the analysis subject does NOT survive a reload — a hand-off, not a stored setting', async ({
	page
}) => {
	await gotoApp(page);
	await page
		.locator('section[aria-label^="world"]')
		.first()
		.getByRole('button', { name: 'Analyse' })
		.click();
	await expect(page.getByTestId('research-subject')).toBeVisible(); // it really was set before the reload

	await page.reload();
	await expect(page.getByTestId('intro')).toBeVisible();
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('intro')).toBeHidden();

	// The MODE persists (a settled preference)…
	await expect(
		page.getByRole('radiogroup', { name: 'lab mode' }).getByRole('radio', { name: 'Research' })
	).toBeChecked();
	// …but the subject does not (a live hand-off from a world you were watching last session, not now).
	await expect(page.getByTestId('research-subject')).toHaveCount(0);
});
