import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	shell,
	SIDEBAR_STORAGE_KEY,
	SIDEBAR_MIN,
	SIDEBAR_MAX,
	SIDEBAR_DEFAULT,
	NARROW_QUERY
} from './shell.svelte';

/**
 * A media query the tests can drive. jsdom's matchMedia never matches and never changes, so a store
 * that decides between "docked" and "overlay" from it would be untestable — and the overlay half of
 * this store is exactly the half worth testing.
 */
function stubViewport(narrow: boolean) {
	const listeners = new Set<() => void>();
	const media = {
		matches: narrow,
		addEventListener: (_: string, fn: () => void) => listeners.add(fn),
		removeEventListener: (_: string, fn: () => void) => listeners.delete(fn)
	};

	vi.stubGlobal('matchMedia', (query: string) => {
		expect(query).toBe(NARROW_QUERY); // the store must ask the question the CSS asks
		return media;
	});

	/** Resize the "window", the way the platform would tell the store about it. */
	return (nowNarrow: boolean) => {
		media.matches = nowNarrow;
		listeners.forEach((fn) => fn());
	};
}

let teardown: () => void = () => {};

beforeEach(() => localStorage.removeItem(SIDEBAR_STORAGE_KEY));

afterEach(() => {
	teardown();
	teardown = () => {};
	vi.unstubAllGlobals();
	localStorage.removeItem(SIDEBAR_STORAGE_KEY);
});

describe('the docked sidebar', () => {
	beforeEach(() => {
		stubViewport(false);
		teardown = shell.init();
	});

	it('opens at the default width', () => {
		expect(shell.open).toBe(true);
		expect(shell.width).toBe(SIDEBAR_DEFAULT);
	});

	it('remembers a width, and a collapse, across a reload', () => {
		shell.setWidth(340);
		shell.toggle();

		// what a fresh page load does with what the last one left behind
		teardown();
		teardown = shell.init();

		expect(shell.width).toBe(340);
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

		teardown();
		teardown = shell.init();

		expect(shell.width).toBe(SIDEBAR_DEFAULT);
		expect(shell.open).toBe(true);
	});
});

describe('the overlay sidebar (no room to dock)', () => {
	let resize: (narrow: boolean) => void;

	beforeEach(() => {
		resize = stubViewport(true);
		teardown = shell.init();
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

		resize(false);

		expect(shell.narrow).toBe(false);
		expect(shell.overlayOpen).toBe(false); // else it would re-open the panel on the next shrink
		expect(shell.open).toBe(true); // now open because it is DOCKED, which is a different reason
	});

	it('stops listening once torn down', () => {
		teardown();
		teardown = () => {};

		resize(false);

		expect(shell.narrow).toBe(true); // the store let go of the viewport, as it was told to
	});
});
