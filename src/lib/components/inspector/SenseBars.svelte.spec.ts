import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import SenseBars from './SenseBars.svelte';
import { bench } from '$lib/state';
import { DEFAULT_WORLDS } from '$lib/engine';
import type { SenseSnapshot } from '$lib/engine';

afterEach(() => bench.destroy());

/**
 * Drives the bars through the store, from a FORGED engine snapshot — which is the point: the panel
 * must be reading the engine's numbers, not computing its own. Paused, so the sharks cannot move
 * the numbers out from under the assertions.
 */
function show(sense: Partial<SenseSnapshot>, senses = DEFAULT_WORLDS[4].senses) {
	bench.init({ configs: [{ ...structuredClone(DEFAULT_WORLDS[4]), senses: { ...senses } }] });
	bench.togglePlay();
	const entry = bench.worlds[0];
	bench.select(entry.id, { type: 'fish', obj: entry.world.fish[0] });

	entry.world.sense = { ...entry.world.sense!, ...sense };
	bench.tick(1 / 60);

	render(SenseBars, { entry });
	return entry;
}

/** The value a given bar is reading out. */
const reads = (label: string) =>
	page.getByText(label).element().parentElement!.querySelector('b')!.textContent;

describe('SenseBars — the three different ways a sense can be quiet', () => {
	it('reads the raw quantity when the predator is in range', () => {
		show({ inVis: true, d: 163.7, dirDeg: -42.4, closing: 33.2, wallFront: 88.9 });

		expect(reads('predator distance')).toBe('164 px');
		expect(reads('direction to threat')).toBe('-42°');
		expect(reads('closing speed')).toBe('+33');
		expect(reads('wall ahead')).toBe('89 px');
	});

	it('says "nothing in range" when the sense works but there is no predator to sense', () => {
		show({ inVis: false, d: Infinity });

		// NOT "0 px" — the fish is not being told the predator is on top of it
		expect(reads('predator distance')).toBe('nothing in range');
		expect(reads('direction to threat')).toBe('—');
		expect(reads('closing speed')).toBe('—');
	});

	it('says "receding" when the predator is there but moving away', () => {
		show({ inVis: true, closing: -12.5 });

		// a negative closing speed is not a small threat, it is the absence of one
		expect(reads('closing speed')).toBe('receding');
	});

	it('says "off" for a neuron this world never gave the brain', () => {
		show(
			{ inVis: true, d: 100, closing: 20, wallFront: 50 },
			{ dist: true, dir: true, closing: false, walls: false }
		);

		expect(reads('closing speed')).toBe('off');
		expect(reads('wall ahead')).toBe('off');
		// and the sense that IS wired still reads its number — "off" is about the neuron, not the world
		expect(reads('predator distance')).toBe('100 px');
	});

	it('empties the bar of a cut sense, whatever the world is doing', () => {
		const entry = show(
			{ inVis: true, nc: 0.9, nw: 0.8 },
			{ dist: true, dir: true, closing: false, walls: false }
		);

		const closing = page.getByText('closing speed').element().closest('div')!.parentElement!;
		const fill = closing.querySelector('.fill') as HTMLElement;
		expect(fill.style.width).toBe('0%'); // the neuron receives 0 — so does the bar
		expect(entry.world.cfg.senses.closing).toBe(false);
	});
});
