/**
 * Theme state. Light ("sunlit") is default; dark is the magenta re-skin.
 *
 * The theme is applied as `data-theme` on <html>, which drives the CSS custom properties in
 * `$lib/styles/tokens.css`. The canvas palettes (`THEMES` in `$lib/render/theme.ts`) are a
 * SEPARATE mirror of the same tokens and must stay in sync (CLAUDE.md conventions).
 *
 * The FIRST resolution happens in `app.html`'s inline head script, before the first paint, so a
 * dark-theme user never sees a flash of light. This store then adopts whatever that script
 * decided — the two must agree on the storage key and the fallback.
 */

import { browser } from '$app/environment';
import type { ThemeName } from '../render';

export const THEME_STORAGE_KEY = 'darwinlab:theme';

function resolve(): ThemeName {
	if (!browser) return 'light';
	// prefer what the pre-paint script already stamped, so we never disagree with the pixels
	const applied = document.documentElement.dataset.theme;
	if (applied === 'light' || applied === 'dark') return applied;

	const saved = localStorage.getItem(THEME_STORAGE_KEY);
	if (saved === 'light' || saved === 'dark') return saved;
	return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

class ThemeStore {
	name = $state<ThemeName>('light');

	/** Adopt the theme the pre-paint script chose. */
	init(): void {
		this.set(resolve());
	}

	set(name: ThemeName): void {
		this.name = name;
		if (!browser) return;
		document.documentElement.dataset.theme = name;
		localStorage.setItem(THEME_STORAGE_KEY, name);
	}

	toggle(): void {
		this.set(this.name === 'light' ? 'dark' : 'light');
	}
}

export const theme = new ThemeStore();
