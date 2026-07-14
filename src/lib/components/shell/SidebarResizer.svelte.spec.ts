import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import SidebarResizer from './SidebarResizer.svelte';
import { shell, SIDEBAR_STORAGE_KEY, SIDEBAR_MIN, SIDEBAR_MAX, SIDEBAR_STEP } from '$lib/state';

/**
 * The divider is the one control here a pointer-only user gets for free and a keyboard user does
 * not, so the keyboard path is the one worth pinning. It drives the real `shell` singleton — that
 * IS the seam under test; a mocked store would prove only that the component calls a spy.
 */
const separator = () => page.getByRole('separator', { name: 'sidebar width' });

/** Focus it the way Tab would, rather than pressing a key AT it (which would focus it first). */
function focusSeparator() {
	(separator().element() as HTMLElement).focus();
}

let width: number;

beforeEach(() => {
	width = shell.width; // put back whatever the suite was using
	localStorage.removeItem(SIDEBAR_STORAGE_KEY);
});

afterEach(() => {
	shell.setWidth(width);
	localStorage.removeItem(SIDEBAR_STORAGE_KEY);
});

describe('SidebarResizer', () => {
	it('reports the width it is currently on, and the range it may move in', () => {
		shell.setWidth(300);
		render(SidebarResizer);

		const element = separator().element();
		expect(element).toHaveAttribute('aria-valuenow', '300');
		expect(element).toHaveAttribute('aria-valuemin', String(SIDEBAR_MIN));
		expect(element).toHaveAttribute('aria-valuemax', String(SIDEBAR_MAX));
	});

	it('widens and narrows the panel a step at a time', async () => {
		shell.setWidth(300);
		render(SidebarResizer);
		focusSeparator();

		await userEvent.keyboard('{ArrowRight}');
		expect(shell.width).toBe(300 + SIDEBAR_STEP);

		await userEvent.keyboard('{ArrowLeft}');
		await userEvent.keyboard('{ArrowLeft}');
		expect(shell.width).toBe(300 - SIDEBAR_STEP);
	});

	it('Home and End go to the ends', async () => {
		shell.setWidth(300);
		render(SidebarResizer);
		focusSeparator();

		await userEvent.keyboard('{End}');
		expect(shell.width).toBe(SIDEBAR_MAX);

		await userEvent.keyboard('{Home}');
		expect(shell.width).toBe(SIDEBAR_MIN);
	});

	it('cannot be driven past the ends', async () => {
		shell.setWidth(SIDEBAR_MAX);
		render(SidebarResizer);
		focusSeparator();

		await userEvent.keyboard('{ArrowRight}');

		expect(shell.width).toBe(SIDEBAR_MAX); // the clamp holds on the keyboard path too
		expect(separator().element()).toHaveAttribute('aria-valuenow', String(SIDEBAR_MAX));
	});

	it('leaves keys that are not its own alone — Space still belongs to the page', async () => {
		// The bench's play/pause shortcut stands down for a focused [role="separator"], which is only
		// safe because the separator does not swallow the key itself.
		shell.setWidth(300);
		render(SidebarResizer);
		focusSeparator();

		await userEvent.keyboard('{ArrowUp}'); // vertical: not a width

		expect(shell.width).toBe(300);
	});
});
