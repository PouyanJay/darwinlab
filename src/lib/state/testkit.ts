/**
 * Test helpers for the stores.
 *
 * `shell` decides between its docked and overlay layouts by asking `matchMedia`, and neither jsdom
 * nor a browser test runner will hand a test the viewport it wants to prove things about. So the
 * question gets a stub, and the store is driven through its real `init()` — mocking the store's own
 * getters instead would be worse than useless: they are backed by `$state`, and replacing one with a
 * plain function silently kills the reactivity that makes the component under test re-render.
 */

import { vi } from 'vitest';
import { shell, NARROW_QUERY } from './shell.svelte';

/**
 * Put the store on the given layout, and hand back the teardown that puts everything back.
 *
 * Returns a `resize` too, for tests about what happens when the window crosses the breakpoint.
 */
export function stubViewport(narrow: boolean): {
	resize: (narrow: boolean) => void;
	restore: () => void;
} {
	const listeners = new Set<() => void>();
	const media = {
		matches: narrow,
		addEventListener: (_: string, fn: () => void) => listeners.add(fn),
		removeEventListener: (_: string, fn: () => void) => listeners.delete(fn)
	};

	vi.stubGlobal('matchMedia', (query: string) => {
		if (query !== NARROW_QUERY) throw new Error(`unexpected media query: ${query}`);
		return media;
	});

	const stopWatching = shell.init();

	return {
		resize: (nowNarrow: boolean) => {
			media.matches = nowNarrow;
			listeners.forEach((fn) => fn());
		},
		restore: () => {
			stopWatching();
			vi.unstubAllGlobals();
		}
	};
}
