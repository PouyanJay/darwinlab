import { describe, it, expect, beforeEach } from 'vitest';
import { app, MODE_STORAGE_KEY } from './app.svelte';

/**
 * The mode store is a singleton; each test restores it to the studio default first, so a test that
 * claims to prove a switch is asserting against a known starting point rather than whatever the
 * previous test left behind.
 */
describe('app mode', () => {
	beforeEach(() => {
		localStorage.removeItem(MODE_STORAGE_KEY);
		app.setMode('studio');
	});

	it('defaults to studio', () => {
		expect(app.mode).toBe('studio');
		expect(app.research).toBe(false);
	});

	it('setMode switches the instrument and flips the research flag', () => {
		expect(app.research).toBe(false); // the state we claim to change really exists first
		app.setMode('research');
		expect(app.mode).toBe('research');
		expect(app.research).toBe(true);
	});

	it('setMode persists the choice', () => {
		app.setMode('research');
		expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('research');
	});

	// Leaving Research must persist too — otherwise a store that only bothers writing the non-default
	// mode would dump a returning user straight back into Research, which is the bug this store exists
	// to prevent.
	it('setMode persists studio when switching back from research', () => {
		app.setMode('research');
		expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('research'); // the value we expect to change
		app.setMode('studio');
		expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('studio');
	});

	it('adopts the saved mode on init', () => {
		localStorage.setItem(MODE_STORAGE_KEY, 'research');
		app.init();
		expect(app.mode).toBe('research');
	});

	it('falls back to studio when nothing is saved', () => {
		localStorage.removeItem(MODE_STORAGE_KEY);
		app.init();
		expect(app.mode).toBe('studio');
	});
});
