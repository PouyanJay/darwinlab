import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import Modal from './Modal.svelte';
import { text } from './testkit';

const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

const conditions = async (open: boolean, onclose = vi.fn()) => {
	const { container, rerender } = render(Modal, {
		open,
		onclose,
		title: 'Conditions',
		subtitle: 'changes apply live to this world',
		children: text('fields go here')
	});
	await settle();
	return { onclose, rerender, dialog: container.querySelector('dialog')! };
};

describe('Modal', () => {
	it('is closed until it is told to open', async () => {
		const { dialog, rerender } = await conditions(false);
		expect(dialog.open).toBe(false);

		await rerender({ open: true });
		expect(dialog.open).toBe(true);
	});

	it('opens as a real modal, so everything behind it is inert and focus starts inside', async () => {
		const { dialog } = await conditions(true);

		// showModal() (not show()) is what buys the focus trap, the top layer and the ::backdrop
		expect(dialog.matches(':modal')).toBe(true);
		expect(dialog.contains(document.activeElement)).toBe(true);
	});

	it('reports Esc rather than swallowing it', async () => {
		const { onclose } = await conditions(true);

		await userEvent.keyboard('{Escape}');

		expect(onclose).toHaveBeenCalledTimes(1);
	});

	it('closes on a backdrop click but not on a click inside the panel', async () => {
		const { onclose, dialog } = await conditions(true);

		await page.getByText('fields go here').click();
		expect(onclose).not.toHaveBeenCalled(); // a click on the content is not a dismissal

		dialog.click(); // the click landed on the dialog box itself — i.e. the backdrop
		expect(onclose).toHaveBeenCalledTimes(1);
	});

	it('closes from its own ✕', async () => {
		const { onclose } = await conditions(true);

		await page.getByRole('button', { name: 'close' }).click();

		expect(onclose).toHaveBeenCalledTimes(1);
	});

	it('gives focus back to whatever opened it', async () => {
		const opener = document.createElement('button');
		document.body.append(opener);
		opener.focus();

		const { rerender } = await conditions(true);
		expect(document.activeElement).not.toBe(opener);

		await rerender({ open: false });
		await settle();
		expect(document.activeElement).toBe(opener);

		opener.remove();
	});
});
