import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import FirstRunHint from './FirstRunHint.svelte';
import { bench } from '$lib/state';

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

	it('retires itself the moment the user opens a mind on their own', async () => {
		render(FirstRunHint);
		await expect.element(hint()).toBeVisible();

		bench.selection = { worldId: 'w1', type: 'fish', followsChampion: false };
		flushSync();

		await expect.element(hint()).not.toBeInTheDocument();
		expect(localStorage.getItem(HINT_STORAGE_KEY)).not.toBeNull(); // the lesson landed — persist it
	});
});
