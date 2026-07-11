import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import EditableLabel from './EditableLabel.svelte';

const worldName = (onchange = vi.fn()) => {
	render(EditableLabel, { value: 'Direction', onchange, label: 'world name' });
	const field = page.getByRole('textbox', { name: 'world name' });
	return { onchange, field, input: field.element() as HTMLInputElement };
};

describe('EditableLabel', () => {
	it('renames live, on every keystroke', async () => {
		const { onchange, field } = worldName();

		await field.fill('Direction + walls');

		expect(onchange).toHaveBeenLastCalledWith('Direction + walls');
	});

	it('Escape abandons the edit and puts the old name back', async () => {
		const { onchange, input } = worldName();

		input.focus(); // focusing is what captures the name to restore
		await userEvent.fill(input, 'oops');
		await userEvent.keyboard('{Escape}');

		expect(onchange).toHaveBeenLastCalledWith('Direction');
		expect(input.value).toBe('Direction');
		expect(document.activeElement).not.toBe(input);
	});

	it('Enter commits and hands focus back', async () => {
		const { onchange, input } = worldName();

		input.focus();
		await userEvent.fill(input, 'Anticipation');
		await userEvent.keyboard('{Enter}');

		expect(onchange).toHaveBeenLastCalledWith('Anticipation');
		expect(document.activeElement).not.toBe(input);
	});
});
