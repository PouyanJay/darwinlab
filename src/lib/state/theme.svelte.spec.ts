import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { theme, THEME_STORAGE_KEY } from './theme.svelte';
import { THEMES } from '../render';

beforeEach(() => localStorage.removeItem(THEME_STORAGE_KEY));
afterEach(() => {
	localStorage.removeItem(THEME_STORAGE_KEY);
	delete document.documentElement.dataset.theme;
	theme.set('light');
});

describe('theme store', () => {
	it('stamps data-theme on <html> and persists the choice', () => {
		theme.set('dark');
		expect(theme.name).toBe('dark');
		expect(document.documentElement.dataset.theme).toBe('dark');
		expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
	});

	it('toggles between light and dark', () => {
		theme.set('light');
		theme.toggle();
		expect(theme.name).toBe('dark');
		theme.toggle();
		expect(theme.name).toBe('light');
	});

	it('adopts whatever the pre-paint script already stamped, so store and pixels never disagree', () => {
		// this is what app.html's inline head script does before the first paint
		document.documentElement.dataset.theme = 'dark';
		localStorage.removeItem(THEME_STORAGE_KEY);

		theme.init();
		expect(theme.name).toBe('dark');
	});

	it('falls back to the saved preference when nothing is stamped yet', () => {
		delete document.documentElement.dataset.theme;
		localStorage.setItem(THEME_STORAGE_KEY, 'dark');

		theme.init();
		expect(theme.name).toBe('dark');
	});
});

describe('canvas palettes', () => {
	it('are distinct per theme, so switching actually repaints the tank differently', () => {
		expect(THEMES.light.fish).not.toBe(THEMES.dark.fish);
		expect(THEMES.light.pred).not.toBe(THEMES.dark.pred);
		expect(THEMES.light.tankEdge).not.toBe(THEMES.dark.tankEdge);
	});

	it('mirror the accent/danger CSS tokens (CLAUDE.md: the two palettes must stay in sync)', () => {
		// tokens.css :root  → --accent #4f56d3, --danger #e8604c
		expect(THEMES.light.fish).toBe('#4f56d3');
		expect(THEMES.light.pred).toBe('#e8604c');
		// tokens.css [data-theme='dark'] → --accent/--danger #ff2d9c
		expect(THEMES.dark.pred).toBe('#ff2d9c');
	});
});
