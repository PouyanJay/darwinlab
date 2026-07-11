import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import ConditionsModal from './ConditionsModal.svelte';
import { bench } from '$lib/state';
import { DEFAULT_WORLDS, ACCENTS } from '$lib/engine';

afterEach(() => bench.destroy());

/** The dialog edits a REAL world through the store — that wiring is most of what it is. */
const open = (onclose = vi.fn()) => {
	bench.init({ configs: [structuredClone(DEFAULT_WORLDS[2])] }); // "Direction"
	const entry = bench.worlds[0];
	render(ConditionsModal, { entry, onclose });
	return { entry, world: entry.world, onclose };
};

describe('ConditionsModal', () => {
	it('opens showing what the world currently is', async () => {
		open();

		await expect
			.element(page.getByRole('textbox', { name: /world name/i }))
			.toHaveValue('Direction');
		// both steppers publish a status output, so ask the Prey group for its own
		const prey = page.getByRole('group', { name: 'Prey' }).getByRole('status');
		await expect.element(prey).toHaveTextContent('20');
		await expect.element(page.getByRole('checkbox', { name: /distance/i })).toBeChecked();
		await expect.element(page.getByRole('checkbox', { name: /walls/i })).not.toBeChecked();
	});

	it('writes a slider straight into the live world', async () => {
		const { world } = open();

		const vision = page.getByRole('slider', { name: /prey vision range/i }).element();
		(vision as HTMLInputElement).value = '260';
		vision.dispatchEvent(new Event('input', { bubbles: true }));

		expect(world.cfg.vision).toBe(260);
	});

	it('steps the population, and the engine grows it to match', async () => {
		const { world } = open();

		await page.getByRole('button', { name: 'more prey' }).click();

		expect(world.cfg.prey).toBe(22);
		expect(world.fish.length).toBe(22); // applyCfg already added them
	});

	it('a sense checkbox cuts the input neuron for every brain in the world', async () => {
		const { world } = open();
		expect(world.cfg.senses.dir).toBe(true);

		await page.getByRole('checkbox', { name: /direction/i }).click();

		expect(world.cfg.senses.dir).toBe(false);
	});

	it('the accent swatches are radios named by colour, so the row is usable without eyes or a mouse', async () => {
		const { world } = open();

		// "violet", not "#8a5ad8" — a screen reader spells a hex out digit by digit
		const violet = page.getByRole('radio', { name: 'violet' });
		await violet.click();

		expect(world.cfg.accent).toBe(ACCENTS[5]);
		await expect.element(violet).toBeChecked();
	});

	it('renaming the world does not touch the simulation', async () => {
		const { world } = open();
		const fish = world.fish[0];

		await page.getByRole('textbox', { name: /world name/i }).fill('Direction (control)');

		expect(world.cfg.name).toBe('Direction (control)');
		expect(world.fish[0]).toBe(fish); // nothing was respawned over a label
	});

	it('reports Esc rather than closing behind its owner’s back', async () => {
		const { onclose } = open();

		await userEvent.keyboard('{Escape}');

		expect(onclose).toHaveBeenCalledTimes(1);
	});

	it('reports the ✕ the same way', async () => {
		// A separate test, not a second act in the one above: Esc really does close the native dialog,
		// so once it has fired there is no ✕ left on screen to click.
		const { onclose } = open();

		await page.getByRole('button', { name: 'close' }).click();

		expect(onclose).toHaveBeenCalledTimes(1);
	});
});
