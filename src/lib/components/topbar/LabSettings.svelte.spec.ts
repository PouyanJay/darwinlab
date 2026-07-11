import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import LabSettings from './LabSettings.svelte';
import { bench } from '$lib/state';
import { DEFAULT_WORLDS, MAX_GENERATIONS_DEFAULT } from '$lib/engine';

afterEach(() => bench.destroy());

/** Open the popover the way a user does — its contents do not exist in the DOM until it is shown. */
const open = async (maxGenerations: number = MAX_GENERATIONS_DEFAULT) => {
	bench.init({ configs: [structuredClone(DEFAULT_WORLDS[2])], maxGenerations });
	bench.togglePlay();
	render(LabSettings);
	await page.getByRole('button', { name: 'lab settings' }).click();
	return page.getByRole('slider', { name: /deploy at/i });
};

describe('LabSettings', () => {
	it('sets the horizon on the bench AND on the worlds already in it', async () => {
		const slider = await open();

		const input = slider.element() as HTMLInputElement;
		input.value = '40';
		input.dispatchEvent(new Event('input', { bubbles: true }));

		expect(bench.maxGenerations).toBe(40);
		expect(bench.worlds[0].world.maxGen).toBe(40); // the engine is the one that has to know
	});

	it('says "never" rather than a smaller number when deployment is switched off', async () => {
		const slider = await open(0);

		// 0 is not "deploy very soon" — it is a different answer, and the panel says so
		await expect.element(slider).toHaveAttribute('aria-valuetext', 'never');
		await expect.element(page.getByText(/keeps evolving forever/)).toBeVisible();
	});

	it('explains what the horizon actually does, in the words that apply', async () => {
		await open(60);

		await expect.element(page.getByText(/At generation 60, training stops for good/)).toBeVisible();
		await expect.element(page.getByText(/no more respawns/)).toBeVisible();
	});
});
