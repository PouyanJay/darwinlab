import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { shell, SIDEBAR_STORAGE_KEY, SIDEBAR_WIDTH } from './shell.svelte';
import { stubViewport } from './testkit';

/**
 * The viewport is stubbed (see testkit): jsdom's matchMedia never matches and never changes, so the
 * store's whole docked-vs-overlay decision would be untestable — and that is the half worth testing.
 */
let viewport: ReturnType<typeof stubViewport>;

beforeEach(() => localStorage.removeItem(SIDEBAR_STORAGE_KEY));

afterEach(() => {
	viewport?.restore();
	localStorage.removeItem(SIDEBAR_STORAGE_KEY);
});

describe('the docked sidebar', () => {
	beforeEach(() => {
		viewport = stubViewport(false);
	});

	it('opens expanded, at the one fixed width', () => {
		expect(shell.open).toBe(true);
		expect(shell.width).toBe(SIDEBAR_WIDTH);
	});

	it('remembers a collapse across a reload — from a collapse alone', () => {
		shell.toggle();

		viewport.restore();
		viewport = stubViewport(false);

		expect(shell.collapsed).toBe(true);
		expect(shell.open).toBe(false);
	});

	it('survives a corrupt saved entry rather than opening broken', () => {
		localStorage.setItem(SIDEBAR_STORAGE_KEY, '{ not json');

		viewport.restore();
		viewport = stubViewport(false);

		expect(shell.open).toBe(true); // opens expanded, not collapsed on garbage
	});
});

describe('the overlay sidebar (no room to dock)', () => {
	beforeEach(() => {
		viewport = stubViewport(true);
	});

	it('starts SHUT even when the remembered preference is expanded', () => {
		// The trap this exists to stop: a desktop session leaves `collapsed: false` behind, and the
		// phone that loads next opens with the control panel sitting on top of the bench.
		expect(shell.collapsed).toBe(false); // …the preference really does say "open"…
		expect(shell.narrow).toBe(true);
		expect(shell.open).toBe(false); // …and the phone still opens on the bench
	});

	it('opens and closes the overlay without touching the docked preference', () => {
		shell.toggle();
		expect(shell.open).toBe(true);
		expect(shell.collapsed).toBe(false); // a phone tap is not a preference

		shell.closeOverlay();
		expect(shell.open).toBe(false);
	});

	it('retires the overlay when the window grows back', () => {
		shell.toggle();
		expect(shell.open).toBe(true);

		viewport.resize(false);

		expect(shell.narrow).toBe(false);
		expect(shell.overlayOpen).toBe(false); // else it would re-open the panel on the next shrink
		expect(shell.open).toBe(true); // now open because it is DOCKED, which is a different reason
	});

	it('stops listening once torn down', () => {
		viewport.restore();

		viewport.resize(false);

		expect(shell.narrow).toBe(true); // the store let go of the viewport, as it was told to
	});
});
