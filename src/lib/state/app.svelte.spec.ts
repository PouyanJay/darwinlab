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
