import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import Stepper from './Stepper.svelte';

const prey = (value: number, onchange = vi.fn()) => {
	render(Stepper, { label: 'Prey', value, min: 2, max: 80, step: 2, onchange });
	return onchange;
};

describe('Stepper', () => {
	it('names its buttons after the thing being counted', async () => {
		const onchange = prey(20);

		await page.getByRole('button', { name: 'more prey' }).click();
		expect(onchange).toHaveBeenCalledWith(22);

		await page.getByRole('button', { name: 'fewer prey' }).click();
		expect(onchange).toHaveBeenLastCalledWith(18);
	});

	it('cannot be nudged out of the range the engine accepts', async () => {
		const onchange = prey(80); // already at max

		const more = page.getByRole('button', { name: 'more prey' }).element() as HTMLButtonElement;
		expect(more.disabled).toBe(true);

		more.click();
		expect(onchange).not.toHaveBeenCalled();
	});

	it('announces the count it lands on rather than clicking in silence', () => {
		prey(20);

		const output = page.getByRole('status').element();
		expect(output.textContent).toBe('20');
	});
});
