/**
 * Canvas palettes. Ported verbatim from engine2.js `THEMES`.
 *
 * ⚠️ MIRROR: a canvas cannot read CSS custom properties, so these are a SECOND copy of the colour
 * tokens declared in `src/lib/styles/tokens.css` — the DOM reads them from there, the tank reads
 * them from here. Change a colour in one file and you must change it in the other, or the tank
 * will paint in a palette the page around it no longer uses (CLAUDE.md conventions).
 *
 * The mapping is not one-to-one: these are the *scene* colours (fish, shark, rays, dust), of which
 * only `ink` / `inkSoft` / `gold` / the accent+danger pair correspond directly to a CSS token.
 */

export type ThemeName = 'light' | 'dark';

/**
 * What the tank is coloured BY.
 *
 * A lens is a way of looking, never a way of changing: 'flee' repaints each fish by how wrong its
 * escape is at this instant, and that is the whole of it. No lens writes to a weight, a fitness, a
 * curve or the RNG — the population that swims under a lens is the identical population that swims
 * without one, frame for frame.
 */
export type Lens = 'none' | 'flee';

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
	/**
	 * The brain viz ONLY: excitatory (+) and inhibitory (−) weights.
	 *
	 * They cannot just be `accent` and `threat`, because in dark those are the SAME magenta — the
	 * reference passes the theme accent in and its dark-mode brain draws both signs identically,
	 * with a legend underneath insisting they differ. In the one panel where the colour IS the
	 * information, the two signs get colours of their own. Mirrored in tokens.css as --excite /
	 * --inhibit for the legend that sits under the canvas.
	 */
	excite: string;
	inhibit: string;
	gold: string;
	ink: string;
	inkSoft: string;
	pill: string;
	shadow: string;
	/**
	 * The flee lens — rgb triplets, composed into rgb() at draw time.
	 *
	 * The ramp DIVERGES around `lensMid`, and the midpoint is not a design choice — it is the null
	 * hypothesis. 90° of flee error is exactly what aimless drift scores: a fish that ignores the
	 * shark entirely averages a right angle to it. So 90° is "no opinion", below it is fleeing, above
	 * it is swimming into the mouth, and the colour says which side of chance the fish is on.
	 *
	 * A plain 0→180 ramp was tried first and was useless: measured populations sit between 70° and
	 * 90°, which on a linear scale is the same muddy middle colour for a world that learned and a
	 * world that did not. The difference was real (blind 85°, bearing 73°) and invisible. Diverging
	 * around chance is what makes a 12° shift a colour a human can actually see.
	 *
	 * `lensIdle` is for a fish with NO READING — nothing in vision, or too slow for its heading to
	 * mean anything. Deliberately a neutral grey, and deliberately not `lensGood`: an unmeasured fish
	 * must never be flattered into looking like a correct one.
	 */
	lensGood: string;
	lensMid: string;
	lensBad: string;
	lensIdle: string;
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
		excite: '#4f56d3',
		inhibit: '#e8604c',
		gold: '#d8a13a',
		ink: '#1d2230',
		inkSoft: 'rgba(29,34,48,.72)', // mirrors --ink2 — deepened with it for the Phase 9 AA gate
		pill: 'rgba(253,253,248,.92)',
		shadow: 'rgba(30,45,35,.09)',
		lensGood: '26,148,120',
		lensMid: '216,161,58',
		lensBad: '201,61,42',
		lensIdle: '150,152,162'
	},
	dark: {
		// Softened from the reference's .42: a 2px magenta rim at nearly half opacity read as a neon
		// sign around every tank, and five of them lit the page instead of the experiment. The tank
		// is a container, not a light source — this is the line that says where the water ends.
		tankEdge: 'rgba(255,45,156,.24)',
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
		// cyan, not magenta: in dark the accent and the danger colour are the same, so an inhibitory
		// edge and an excitatory one would be indistinguishable.
		excite: '#38d0f5',
		inhibit: '#ff2d9c',
		gold: '#ffd166',
		ink: '#f5f5fa',
		inkSoft: 'rgba(245,245,250,.68)', // mirrors --ink2 — deepened with it for the Phase 9 AA gate
		pill: 'rgba(12,12,17,.88)',
		shadow: 'rgba(0,0,0,.4)',
		// NOT the predator's magenta for `bad`: a fish painted in the shark's own colour is a fish
		// the eye stops finding. Cyan → rose is the ramp that stays legible against a magenta hunter.
		lensGood: '56,208,245',
		lensMid: '255,209,102',
		lensBad: '255,92,124',
		lensIdle: '138,140,155'
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
	 * What the tank is COLOURED by. 'none' paints the fish in the palette's own colour; 'flee' paints
	 * each one by how wrong its escape is right now (engine/flee.ts). A lens changes what you SEE,
	 * never what evolved — no lens touches a single weight, a fitness, or a curve.
	 */
	lens?: Lens;
	/**
	 * Freeze tail-flick, shark sway and signal pulses to a legible static state.
	 * INJECTED (the reference read `matchMedia` at module scope; render must stay DOM-free).
	 */
	reducedMotion?: boolean;
}
