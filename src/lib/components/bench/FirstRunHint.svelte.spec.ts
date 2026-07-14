import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import FirstRunHint from './FirstRunHint.svelte';
import { bench, shell } from '$lib/state';
import { stubViewport } from '$lib/state/testkit';

const HINT_STORAGE_KEY = 'darwinlab:hint-dismissed';

/**
 * The bench singleton is never init()ed here — that would start a live loop with sharks eating
 * in the background. The hint only reads `bench.selection`, which is a public $state field, so
 * the tests write it directly and put it back.
 */
beforeEach(() => localStorage.removeItem(HINT_STORAGE_KEY));
afterEach(() => {
	localStorage.removeItem(HINT_STORAGE_KEY);
	bench.selection = null;
	vi.restoreAllMocks();
});

const hint = () => page.getByText('click any fish to open its mind');

describe('FirstRunHint', () => {
	it('shows on a first visit', async () => {
		render(FirstRunHint);
		await expect.element(hint()).toBeVisible();
	});

	it('the ✕ dismisses it — for good, not for the session', async () => {
		render(FirstRunHint);
		await page.getByRole('button', { name: 'dismiss hint' }).click();

		await expect.element(hint()).not.toBeInTheDocument();
		expect(localStorage.getItem(HINT_STORAGE_KEY)).not.toBeNull();
	});

	it('never shows again once dismissed', async () => {
		localStorage.setItem(HINT_STORAGE_KEY, 'true');
		render(FirstRunHint);
		await expect.element(hint()).not.toBeInTheDocument();
	});

	it('stands down while the phone control panel covers the bench', async () => {
		/*
		 * The hint points at fish. On a phone the control panel is an OVERLAY, so while it is open
		 * there are no fish on screen to point at — and the hint, pinned above everything, would print
		 * itself straight across the open panel.
		 *
		 * Driven through the REAL store (a stubbed viewport, then a real toggle), because the flag it
		 * obeys is a `$state`-backed getter: mock the getter and you replace it with a plain function,
		 * which reads correctly, re-renders never, and passes this test for the wrong reason.
		 */
		const viewport = stubViewport(true);
		render(FirstRunHint);
		await expect.element(hint()).toBeVisible(); // it really was on screen first

		shell.toggle(); // open the panel over the bench
		flushSync();

		await expect.element(hint()).not.toBeInTheDocument();

		shell.closeOverlay();
		flushSync();

		await expect.element(hint()).toBeVisible(); // and it comes back with the bench
		viewport.restore();
	});

	it('retires itself the moment the user opens a mind on their own', async () => {
		render(FirstRunHint);
		await expect.element(hint()).toBeVisible();

		bench.selection = { worldId: 'w1', type: 'fish', followsChampion: false };
		flushSync();

		await expect.element(hint()).not.toBeInTheDocument();
		expect(localStorage.getItem(HINT_STORAGE_KEY)).not.toBeNull(); // the lesson landed — persist it
	});
});
