import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import ConditionsModal from './ConditionsModal.svelte';
import { bench } from '$lib/state';
import { DEFAULT_WORLDS, ACCENTS } from '$lib/engine';

afterEach(() => bench.destroy());

/**
 * The dialog edits a REAL world through the store — that wiring is most of what it is.
 *
 * PAUSED, though. `init` starts the genuine sim loop, and a running world has sharks eating fish in
 * the background: `fish.length` would then be a moving target, and `fish[0]` could be swallowed
 * mid-test. Pausing freezes the world so the only thing that can change it is the edit under test.
 */
const open = (onclose = vi.fn()) => {
	bench.init({ configs: [structuredClone(DEFAULT_WORLDS[2])] }); // "Direction"
	bench.togglePlay();
	const entry = bench.worlds[0];
	render(ConditionsModal, { entry, onclose });
	return { entry, world: entry.world, onclose };
};

/**
 * The conditions are grouped into three tabs now — Environment, Agents, Adversary. A field only
 * exists once its group is showing, so every test that reaches for one opens its group first.
 */
const openGroup = (name: 'Environment' | 'Agents' | 'Adversary') =>
	page
		.getByRole('radiogroup', { name: /which part of the experiment/i })
		.getByRole('radio', { name })
		.click();

describe('ConditionsModal', () => {
	it('opens showing what the world currently is', async () => {
		open();

		await expect
			.element(page.getByRole('textbox', { name: /world name/i }))
			.toHaveValue('Direction');

		await openGroup('Agents');
		const count = page.getByRole('group', { name: 'Fish' }).getByRole('status');
		await expect.element(count).toHaveTextContent('20');
		await expect.element(page.getByRole('checkbox', { name: /distance/i })).toBeChecked();
		await expect.element(page.getByRole('checkbox', { name: /walls/i })).not.toBeChecked();
	});

	it('writes a slider straight into the live world', async () => {
		const { world } = open();
		await openGroup('Agents');

		const vision = page.getByRole('slider', { name: /vision range/i }).element();
		(vision as HTMLInputElement).value = '260';
		vision.dispatchEvent(new Event('input', { bubbles: true }));

		expect(world.cfg.vision).toBe(260);
	});

	it('the new AGENT top-speed slider writes into the live world', async () => {
		const { world } = open();
		await openGroup('Agents');

		const speed = page.getByRole('slider', { name: /top speed/i }).element();
		(speed as HTMLInputElement).value = '240';
		speed.dispatchEvent(new Event('input', { bubbles: true }));

		expect(world.cfg.maxSpeed).toBe(240);
	});

	it('steps the population, and the engine grows it to match', async () => {
		const { world } = open();
		await openGroup('Agents');

		await page.getByRole('button', { name: 'more fish' }).click();

		expect(world.cfg.prey).toBe(22);
		expect(world.fish.length).toBe(22); // applyCfg already added them
	});

	it('the ADVERSARY dart toggle cuts the strike in the live world', async () => {
		const { world } = open();
		expect(world.cfg.lunge ?? true).toBe(true); // darts by default
		await openGroup('Adversary');

		await page.getByRole('checkbox', { name: /darts at its target/i }).click();

		// the ENGINE has it, not merely the mirror the dialog binds to
		expect(world.cfg.lunge).toBe(false);
	});

	it('the hunger ramp is OFF, and its knobs stay hidden until it is switched on', async () => {
		const { world } = open();
		expect(world.cfg.persistence).toBe(false); // the bench's default, and a product decision
		await openGroup('Adversary');

		await expect
			.element(page.getByRole('slider', { name: /how fast hunger builds/i }))
			.not.toBeInTheDocument();

		await page.getByRole('checkbox', { name: /escalate while hungry/i }).click();

		expect(world.cfg.persistence).toBe(true);
		expect(world.cfg.persistRamp).toBe(0.04);
		expect(world.cfg.persistMaxBoost).toBe(0.85);
		expect(world.cfg.persistMaxJaw).toBe(20);
		await expect
			.element(page.getByRole('slider', { name: /how fast hunger builds/i }))
			.toBeInTheDocument();
	});

	it('the ramp knobs write into the live world', async () => {
		const { world } = open();
		await openGroup('Adversary');
		await page.getByRole('checkbox', { name: /escalate while hungry/i }).click();

		const jaw = page.getByRole('slider', { name: /widest bite/i }).element();
		(jaw as HTMLInputElement).value = '40';
		jaw.dispatchEvent(new Event('input', { bubbles: true }));

		expect(world.cfg.persistMaxJaw).toBe(40);
	});

	it('says when the adversary has become too fast for any sense to matter', async () => {
		// The most consequential comparison on the bench: above the agent's own top speed, nothing can
		// outswim the adversary — knowing which way to flee buys a delay and never an escape, and every
		// sense stops paying. The dialog has to SAY that, from the adversary's own group.
		open();
		await openGroup('Adversary');
		const speed = page.getByRole('slider', { name: /cruise speed/i }).element();

		await expect.element(page.getByText(/something to earn/i)).toBeInTheDocument();

		(speed as HTMLInputElement).value = '1.4';
		speed.dispatchEvent(new Event('input', { bubbles: true }));

		await expect.element(page.getByText(/no sense pays/i)).toBeInTheDocument();
	});

	it('a sense checkbox cuts the input neuron for every brain in the world', async () => {
		const { world } = open();
		expect(world.cfg.senses.dir).toBe(true);
		await openGroup('Agents');

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
		const { onclose } = open();

		await page.getByRole('button', { name: 'close' }).click();

		expect(onclose).toHaveBeenCalledTimes(1);
	});
});
