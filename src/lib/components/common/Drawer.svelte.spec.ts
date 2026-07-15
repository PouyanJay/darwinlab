import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import Drawer from './Drawer.svelte';
import { text } from './testkit';

const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

const inspector = async (open: boolean, onclose = vi.fn()) => {
	const { rerender } = render(Drawer, {
		open,
		onclose,
		title: 'Fish mind, live',
		subtitle: 'one real evolved brain in “Direction”',
		live: true,
		children: text('the brain')
	});
	await settle();
	return { onclose, rerender };
};

describe('Drawer', () => {
	it('is not rendered at all until it is opened', async () => {
		const { rerender } = await inspector(false);
		expect(document.querySelector('[role="dialog"]')).toBeNull();

		await rerender({ open: true });
		expect(page.getByRole('dialog', { name: 'Fish mind, live' }).element()).toBeTruthy();
	});

	it('leaves the bench behind it live — it is a panel, not a modal', async () => {
		await inspector(true);

		const drawer = page.getByRole('dialog').element();
		// aria-modal="false" is the honest answer: you inspect a brain while watching it swim
		expect(drawer).toHaveAttribute('aria-modal', 'false');
		expect((drawer as HTMLElement).matches(':modal')).toBe(false);
	});

	it('takes focus when it opens and hands it back when it closes', async () => {
		const opener = document.createElement('button');
		document.body.append(opener);
		opener.focus();

		const { rerender } = await inspector(true);
		expect(page.getByRole('dialog').element().contains(document.activeElement)).toBe(true);

		await rerender({ open: false });
		await settle();
		expect(document.activeElement).toBe(opener); // back where the user left off

		opener.remove();
	});

	it('closes on Esc and from its own ✕', async () => {
		const { onclose } = await inspector(true);

		await userEvent.keyboard('{Escape}');
		expect(onclose).toHaveBeenCalledTimes(1);

		await page.getByRole('button', { name: 'close inspector' }).click();
		expect(onclose).toHaveBeenCalledTimes(2);
	});

	it('does not steal Esc from a modal opened on top of it', async () => {
		const { onclose } = await inspector(true);

		// Stand in for the Conditions modal: a native dialog, open, above the drawer.
		const modal = document.createElement('dialog');
		document.body.append(modal);
		modal.showModal();

		await userEvent.keyboard('{Escape}');

		expect(onclose).not.toHaveBeenCalled(); // the modal owns that keypress; the drawer survives it
		modal.remove();
	});
});
