/**
 * Canonical breakpoints - the ONE source of truth for where the layout changes.
 *
 * The app used to hard-code a dozen unrelated thresholds (460/560/620/640/720/760/820/900/1100/1200/
 * 1240), and the JS sidebar switch shared a value with none of them. These six steps replace that
 * scatter: every @media / @container rule now snaps to one of them, and JS reads them from here.
 *
 * CSS cannot read a custom property inside a @media condition, so the same pixel values are also
 * written into styles/tokens.css (as the documented reference) and into each component's @media rule.
 * Keep the three in sync: this module is the source, tokens.css is the map, the rules are the uses.
 */
export const BP = {
	xs: 480, // small phone
	sm: 640, // phone; drop non-essential chrome, stack two-column fields
	md: 768, // large phone / tablet portrait; single-column workspaces
	lg: 900, // below this a docked sidebar has no room - the compact-chrome line
	xl: 1100, // laptop
	xxl: 1200 // desktop; the widest multi-column layouts appear at/above this
} as const;

export type Breakpoint = keyof typeof BP;

/** `(max-width: Npx)` - the "this width and narrower" query, for matchMedia and CSS parity. */
export const below = (bp: Breakpoint): string => `(max-width: ${BP[bp]}px)`;

/** `(min-width: Npx)` - the "this width and wider" query. */
export const above = (bp: Breakpoint): string => `(min-width: ${BP[bp]}px)`;
