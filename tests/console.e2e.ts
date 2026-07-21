import { expect, test } from '@playwright/test';
import { gotoApp, openResearch } from './helpers';

/**
 * The Research console shell (RC0): the three zones and their landmarks exist, the persistent right
 * SIDEBAR adapts to whichever instrument the rail has active, and the rail nav is a real roving
 * tablist that steps over the not-yet-built Report. No existing spec guards any of this.
 *
 * These assert STRUCTURE, not measurements: nothing is run, so every panel is in its empty state —
 * which is exactly the state whose copy must stay honest ("Not tested yet", "Run the Sweep …").
 */

test('the console has three zones and the sidebar follows the active instrument', async ({
	page
}) => {
	await gotoApp(page);
	await openResearch(page);

	// The two landmarks the phase's gate calls for: the rail is navigation, the sidebar complementary.
	await expect(page.getByRole('navigation', { name: 'research' })).toBeVisible();
	const sidebar = page.getByRole('complementary', { name: 'research context' });
	await expect(sidebar).toBeVisible();

	// The rail leads with the subject world every instrument runs on.
	await expect(page.getByTestId('research-rail')).toContainText('Generic world');

	// Default instrument is the Sweep: the workspace shows it, the sidebar shows its run context.
	await expect(page.getByTestId('sweep')).toBeVisible();
	await expect(sidebar).toContainText('This run');
	await expect(page.locator('#rtab-sweep')).toHaveAttribute('aria-selected', 'true');

	// The Ledger — selection flips on the tab, the sidebar swaps to the active claim (untested, and it
	// says so honestly rather than inventing a verdict).
	await page.getByRole('tab', { name: 'The Ledger' }).click();
	await expect(page.locator('#rtab-ledger')).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('#rtab-sweep')).toHaveAttribute('aria-selected', 'false');
	await expect(page.getByTestId('ledger')).toBeVisible();
	await expect(sidebar).toContainText('This claim');
	await expect(sidebar).toContainText('Not tested yet');

	// The Atlas — the sidebar becomes the landscape panel (its empty state until a landscape is run).
	await page.getByRole('tab', { name: 'The Atlas' }).click();
	await expect(page.getByTestId('atlas')).toBeVisible();
	await expect(sidebar).toContainText('This landscape');

	// The Report is shown as a not-yet-built instrument, disabled — never a dead tab that opens nothing.
	await expect(page.getByRole('tab', { name: 'The Report' })).toBeDisabled();
});

test('the rail nav is a roving tablist: arrows cycle the ready instruments and skip the disabled one', async ({
	page
}) => {
	await gotoApp(page);
	await openResearch(page);

	// Focus the active tab, then walk the choice with the keyboard (page.keyboard, not locator.press —
	// the latter refocuses its target and would defeat the point of testing where focus already is).
	await page.locator('#rtab-sweep').focus();

	await page.keyboard.press('ArrowDown');
	await expect(page.locator('#rtab-ledger')).toBeFocused();
	await expect(page.locator('#rtab-ledger')).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByTestId('ledger')).toBeVisible();

	await page.keyboard.press('ArrowDown');
	await expect(page.locator('#rtab-atlas')).toBeFocused();

	// Past the last ready instrument it wraps straight back to the Sweep — the disabled Report is never
	// landed on (it is not in the roving set), so it can never become the selection.
	await page.keyboard.press('ArrowDown');
	await expect(page.locator('#rtab-sweep')).toBeFocused();
	await expect(page.getByTestId('sweep')).toBeVisible();
});
