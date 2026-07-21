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
import { newWorldConfig, type WorldConfig } from '../engine';

export type AppMode = 'studio' | 'research';

export const MODE_STORAGE_KEY = 'darwinlab:mode';

function resolveMode(): AppMode {
	if (!browser) return 'studio';
	return localStorage.getItem(MODE_STORAGE_KEY) === 'research' ? 'research' : 'studio';
}

class AppStore {
	#mode = $state<AppMode>('studio');

	// The world Research is exploring around — set by "Analyse in Research" from a Studio world. Null
	// means Research runs on a fresh, generic world. `$state.raw`: it is a whole config, only ever
	// replaced, never mutated in place. Deliberately NOT persisted — a subject is a live hand-off from
	// the world you were just watching, not a setting to restore into an empty next session.
	#subject = $state.raw<WorldConfig | null>(null);

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

	/** The world Research is currently analysing, or null when it explores a generic world. */
	get subject(): WorldConfig | null {
		return this.#subject;
	}

	/**
	 * Carry a Studio world into Research: seed it as the subject and switch modes. This is the
	 * Studio→Research half of the round-trip (the mirror of the Atlas's `watch`), the move that makes
	 * "analyse the world I was just watching" one click instead of a manual reconstruction.
	 */
	analyze(cfg: WorldConfig): void {
		this.#subject = cfg;
		this.setMode('research');
	}

	/** Drop the subject — Research goes back to exploring a fresh, generic world. */
	clearSubject(): void {
		this.#subject = null;
	}

	/**
	 * The base config a Research instrument builds its runs on: the analysed world (relabelled for the
	 * instrument, since name/accent are chrome the science ignores) when one is set, otherwise a fresh
	 * generic world. One source, so the Sweep, the Ledger and the Atlas all explore the SAME subject.
	 */
	subjectBase(label: string, accent: string): WorldConfig {
		return this.#subject
			? { ...this.#subject, name: label, accent }
			: newWorldConfig(label, accent);
	}
}

export const app = new AppStore();
