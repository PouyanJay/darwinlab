import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import Slider from './Slider.svelte';

const mutation = (onchange = vi.fn()) => {
	render(Slider, {
		label: 'Mutation rate',
		value: 0.06,
		min: 0,
		max: 0.2,
		step: 0.005,
		onchange,
		format: (v: number) => v.toFixed(3)
	});
	return onchange;
};

describe('Slider', () => {
	it('reports every change as it is dragged, so the world can be edited live', async () => {
		const onchange = mutation();

		const slider = page.getByRole('slider', { name: /mutation rate/i }).element();
		(slider as HTMLInputElement).value = '0.075';
		slider.dispatchEvent(new Event('input', { bubbles: true }));

		expect(onchange).toHaveBeenCalledWith(0.075);
	});

	it('steps with the arrow keys', async () => {
		const onchange = mutation();

		(page.getByRole('slider').element() as HTMLInputElement).focus();
		await userEvent.keyboard('{ArrowRight}');

		expect(onchange).toHaveBeenCalledWith(0.065); // value + one step
	});

	it('reads its value out the same way it shows it', () => {
		mutation();

		const slider = page.getByRole('slider').element();
		expect(slider).toHaveAttribute('aria-valuetext', '0.060');
		expect(page.getByText('0.060').element()).toBeTruthy();
	});

	it('holds no value of its own — what it shows is what it was given', async () => {
		// A slider that kept a private copy could drift from the world it is steering.
		const onchange = vi.fn();
		const { rerender } = render(Slider, {
			label: 'Prey vision range',
			value: 160,
			min: 120,
			max: 280,
			step: 5,
			onchange
		});

		const slider = page.getByRole('slider').element() as HTMLInputElement;
		slider.value = '200';
		slider.dispatchEvent(new Event('input', { bubbles: true }));
		expect(onchange).toHaveBeenCalledWith(200);

		await rerender({ value: 130 }); // the store said 130, not 200 — the slider must obey
		expect(slider.value).toBe('130');
	});
});
