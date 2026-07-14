import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	shell,
	SIDEBAR_STORAGE_KEY,
	SIDEBAR_MIN,
	SIDEBAR_MAX,
	SIDEBAR_DEFAULT
} from './shell.svelte';
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

	it('opens at the default width', () => {
		expect(shell.open).toBe(true);
		expect(shell.width).toBe(SIDEBAR_DEFAULT);
	});

	/**
	 * The two preferences are saved by two different paths, so they are tested by two different
	 * tests. Asserting them together passed even with the save torn out of `setWidth` — `toggle()`
	 * persists BOTH fields, so it was quietly saving the width the other path had stopped saving. A
	 * user who only ever drags the divider would have lost it on every reload, and the test would
	 * have gone on being green.
	 */
	it('remembers a width across a reload — from a drag alone', () => {
		shell.setWidth(340);

		// what a fresh page load does with what the last one left behind
		viewport.restore();
		viewport = stubViewport(false);

		expect(shell.width).toBe(340);
	});

	it('remembers a collapse across a reload — from a collapse alone', () => {
		shell.toggle();

		viewport.restore();
		viewport = stubViewport(false);

		expect(shell.collapsed).toBe(true);
		expect(shell.open).toBe(false);
	});

	it('clamps a width to what the panel can actually be', () => {
		shell.setWidth(9000);
		expect(shell.width).toBe(SIDEBAR_MAX);

		shell.setWidth(10);
		expect(shell.width).toBe(SIDEBAR_MIN);
	});

	it('survives a corrupt saved entry rather than opening broken', () => {
		localStorage.setItem(SIDEBAR_STORAGE_KEY, '{ not json');

		viewport.restore();
		viewport = stubViewport(false);

		expect(shell.width).toBe(SIDEBAR_DEFAULT);
		expect(shell.open).toBe(true);
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
