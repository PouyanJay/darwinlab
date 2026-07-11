import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import Button from './Button.svelte';
import { text } from './testkit';

describe('Button', () => {
	it('activates by click, by Enter and by Space (the Phase 3 keyboard gate)', async () => {
		const onclick = vi.fn();
		render(Button, { children: text('Evolve'), onclick });
		const button = page.getByRole('button', { name: 'Evolve' });

		await button.click();
		expect(onclick).toHaveBeenCalledTimes(1);

		(button.element() as HTMLButtonElement).focus();
		await userEvent.keyboard('{Enter}');
		expect(onclick).toHaveBeenCalledTimes(2);

		await userEvent.keyboard(' ');
		expect(onclick).toHaveBeenCalledTimes(3);
	});

	it('is a plain button by default, so it can never submit a surrounding form by accident', () => {
		render(Button, { children: text('Train') });
		const button = page.getByRole('button').element() as HTMLButtonElement;
		expect(button.type).toBe('button');
	});

	it('does not fire when disabled', () => {
		const onclick = vi.fn();
		render(Button, { children: text('Play story'), onclick, disabled: true });

		const button = page.getByRole('button', { name: 'Play story' }).element() as HTMLButtonElement;
		button.click();

		expect(onclick).not.toHaveBeenCalled();
	});

	it('passes native button attributes through, so an icon button can still be named', () => {
		render(Button, {
			children: text('✕'),
			variant: 'icon',
			tone: 'danger',
			'aria-label': 'remove world',
			title: 'remove world'
		});

		// a glyph is not an accessible name — the label is what AT reads out
		const button = page.getByRole('button', { name: 'remove world' }).element();
		expect(button.getAttribute('title')).toBe('remove world');
	});
});
