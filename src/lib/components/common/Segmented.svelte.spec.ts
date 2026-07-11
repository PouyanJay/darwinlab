import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import Segmented from './Segmented.svelte';

const SPEEDS = [
	{ value: 0.5, label: '½×' },
	{ value: 1, label: '1×' },
	{ value: 2, label: '2×' }
];

const mount = (value: number, onchange = vi.fn()) => {
	render(Segmented, { options: SPEEDS, value, onchange, label: 'simulation speed' });
	return onchange;
};

describe('Segmented', () => {
	it('exposes exactly one checked option out of the group', () => {
		mount(1);

		expect(page.getByRole('radiogroup', { name: 'simulation speed' }).element()).toBeTruthy();
		expect(page.getByRole('radio', { name: '1×' }).element()).toHaveAttribute(
			'aria-checked',
			'true'
		);
		expect(page.getByRole('radio', { name: '2×' }).element()).toHaveAttribute(
			'aria-checked',
			'false'
		);
	});

	it('reports the picked value on click', async () => {
		const onchange = mount(1);

		await page.getByRole('radio', { name: '2×' }).click();

		expect(onchange).toHaveBeenCalledWith(2);
	});

	it('moves the choice with the arrow keys and Home/End', async () => {
		const onchange = mount(1);
		(page.getByRole('radio', { name: '1×' }).element() as HTMLButtonElement).focus();

		await userEvent.keyboard('{ArrowRight}');
		expect(onchange).toHaveBeenLastCalledWith(2);

		await userEvent.keyboard('{ArrowLeft}');
		expect(onchange).toHaveBeenLastCalledWith(0.5);

		await userEvent.keyboard('{End}');
		expect(onchange).toHaveBeenLastCalledWith(2);

		await userEvent.keyboard('{Home}');
		expect(onchange).toHaveBeenLastCalledWith(0.5);
	});

	it('wraps around at the ends rather than dead-ending', async () => {
		const onchange = mount(0.5);
		(page.getByRole('radio', { name: '½×' }).element() as HTMLButtonElement).focus();

		await userEvent.keyboard('{ArrowLeft}');

		expect(onchange).toHaveBeenLastCalledWith(2);
	});

	it('holds a single tab stop: Tab lands on the chosen segment, not on all three', () => {
		mount(2);

		const tabbable = SPEEDS.map(({ label }) =>
			page.getByRole('radio', { name: label }).element().getAttribute('tabindex')!
		);

		expect(tabbable).toEqual(['-1', '-1', '0']);
	});
});
