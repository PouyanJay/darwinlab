import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import SensePill from './SensePill.svelte';

const pill = (on: boolean, onclick = vi.fn()) => {
	render(SensePill, { label: 'dir', name: 'Direction', on, onclick });
	return { onclick, button: page.getByRole('button', { name: 'dir' }) };
};

describe('SensePill', () => {
	it('says whether the neuron is live, not just colours it in', () => {
		const { button } = pill(true);

		// the fill is not the only place this information exists — a screen reader hears "pressed"
		expect(button.element()).toHaveAttribute('aria-pressed', 'true');
	});

	it('says what clicking it will do to the brain', () => {
		const wired = pill(true);
		expect(wired.button.element()).toHaveAttribute('title', 'cut direction input neuron');

		document.body.replaceChildren();

		const cut = pill(false);
		expect(cut.button.element()).toHaveAttribute('title', 'grow direction input neuron');
	});

	it('reports the toggle rather than deciding it — the world is what changes', async () => {
		const { onclick, button } = pill(true);

		await button.click();

		expect(onclick).toHaveBeenCalledTimes(1);
		// it does NOT flip itself: the pill shows the world's state, and the store owns that
		expect(button.element()).toHaveAttribute('aria-pressed', 'true');
	});
});
