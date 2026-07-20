/**
 * App mode — which INSTRUMENT the lab is presenting.
 *
 * The lab is one place with two modes: STUDIO (watch a world evolve, read one brain) and RESEARCH
 * (run many simulations, extract conclusions). The mode is the highest-level lens over the SAME
 * worlds and the SAME engine — switching it swaps the stage and the controls, never the science.
 * That is why it lives in the top bar, not the sidebar: a mode is identity, not a bench control.
 *
 * It persists to localStorage so a reload returns you where you were, and it resolves to `studio`
 * on the server / first load (the prerendered SPA has no `window`), adopting the saved value in
 * `init()` once the browser is there — the same shape as the theme store.
 */

import { browser } from '$app/environment';

export type AppMode = 'studio' | 'research';

export const MODE_STORAGE_KEY = 'darwinlab:mode';

function resolveMode(): AppMode {
	if (!browser) return 'studio';
	return localStorage.getItem(MODE_STORAGE_KEY) === 'research' ? 'research' : 'studio';
}

class AppStore {
	#mode = $state<AppMode>('studio');

	/** Adopt the persisted mode. Called once the browser is present (onMount). */
	init(): void {
		this.setMode(resolveMode());
	}

	get mode(): AppMode {
		return this.#mode;
	}

	/** True in Research — the one flag the shell branches on. */
	get research(): boolean {
		return this.#mode === 'research';
	}

	/** Switch instruments. Persists, and leaves the live bench untouched. */
	setMode(mode: AppMode): void {
		this.#mode = mode;
		if (browser) localStorage.setItem(MODE_STORAGE_KEY, mode);
	}
}

export const app = new AppStore();
