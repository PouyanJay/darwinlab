/**
 * Theme state. Light ("sunlit") is default; dark is the magenta re-skin.
 *
 * The theme is applied as `data-theme` on <html>, which drives the CSS custom properties in
 * `$lib/styles/tokens.css`. The canvas palettes (`THEMES` in `$lib/render/theme.ts`) are a
 * SEPARATE mirror of the same tokens and must stay in sync (CLAUDE.md conventions).
 */

import { browser } from '$app/environment';
import type { ThemeName } from '../render';

const STORAGE_KEY = 'darwinlab:theme';

function initial(): ThemeName {
	if (!browser) return 'light';
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved === 'light' || saved === 'dark') return saved;
	return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

class ThemeStore {
	name = $state<ThemeName>('light');

	/** Read once on the client — the app is CSR-only, so this runs in the browser. */
	init(): void {
		this.set(initial());
	}

	set(name: ThemeName): void {
		this.name = name;
		if (!browser) return;
		document.documentElement.dataset.theme = name;
		localStorage.setItem(STORAGE_KEY, name);
	}

	toggle(): void {
		this.set(this.name === 'light' ? 'dark' : 'light');
	}
}

export const theme = new ThemeStore();

/** Whether the user has asked for reduced motion — injected into the renderers. */
export function prefersReducedMotion(): boolean {
	return browser && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
