/**
 * Canvas palettes. Ported verbatim from engine2.js `THEMES`.
 *
 * IMPORTANT: these are a SEPARATE copy of the design tokens used by the CSS
 * (`src/lib/styles/tokens.css`). The two must stay in sync — see CLAUDE.md conventions.
 */

export type ThemeName = 'light' | 'dark';

export interface ThemePalette {
	tankEdge: string;
	/** rgb triplet (no alpha) — composed into rgba() at draw time. */
	ray: string;
	dust: string;
	fish: string;
	fishBelly: string;
	fishTrail: string;
	pred: string;
	predDark: string;
	predBelly: string;
	burst: string;
	sel: string;
	selGlow: string;
	threat: string;
	gold: string;
	ink: string;
	inkSoft: string;
	pill: string;
	shadow: string;
}

export const THEMES: Record<ThemeName, ThemePalette> = {
	light: {
		tankEdge: 'rgba(29,34,48,.26)',
		ray: '255,250,215',
		dust: 'rgba(105,118,96,.4)',
		fish: '#4f56d3',
		fishBelly: '#dfe1f8',
		fishTrail: '79,86,211',
		pred: '#e8604c',
		predDark: '#b8422f',
		predBelly: '#f6cabf',
		burst: '232,96,76',
		sel: '#4f56d3',
		selGlow: '79,86,211',
		threat: '#e8604c',
		gold: '#d8a13a',
		ink: '#1d2230',
		inkSoft: 'rgba(29,34,48,.55)',
		pill: 'rgba(253,253,248,.92)',
		shadow: 'rgba(30,45,35,.09)'
	},
	dark: {
		tankEdge: 'rgba(255,45,156,.42)',
		ray: '255,45,156',
		dust: 'rgba(255,255,255,.22)',
		fish: '#f2f2f7',
		fishBelly: '#a3a4bc',
		fishTrail: '242,242,247',
		pred: '#ff2d9c',
		predDark: '#a91d6d',
		predBelly: '#ff8cc7',
		burst: '255,45,156',
		sel: '#ff2d9c',
		selGlow: '255,45,156',
		threat: '#ff2d9c',
		gold: '#ffd166',
		ink: '#f5f5fa',
		inkSoft: 'rgba(245,245,250,.6)',
		pill: 'rgba(12,12,17,.88)',
		shadow: 'rgba(0,0,0,.4)'
	}
};

/** Options common to the world renderer. */
export interface DrawWorldOpts {
	theme?: ThemeName;
	/** 'performance' scales god-rays/particulate down so many tiles stay smooth. */
	detail?: 'cinematic' | 'performance';
	/** Big/cinematic mode — the story stage. */
	big?: boolean;
	/**
	 * Freeze tail-flick, shark sway and signal pulses to a legible static state.
	 * INJECTED (the reference read `matchMedia` at module scope; render must stay DOM-free).
	 */
	reducedMotion?: boolean;
}
