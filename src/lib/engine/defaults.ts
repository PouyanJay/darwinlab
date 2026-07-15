/**
 * The seeded bench — the sense ladder — and the accent palette.
 *
 * Every world here runs in an ocean where a sense can actually pay for itself (SHOWCASE_OCEAN
 * below says how, and why each setting exists). The ladder then climbs honestly:
 *   blind 3.18s · +distance 3.33s · +direction 4.43s · +walls 4.78s · +closing (all four) 5.46s
 * (mean life per fish, 3 evolution seeds × 12 seeded bouts — scripts/sweep-senses.ts).
 *
 * It did not always. Under the original settings — a shark that outran every fish, a free
 * wall-avoidance instinct, a strike that re-aimed mid-flight — no sense could buy anything, and a
 * fish with ALL FOUR of them survived ~5% LESS than a blind one, because mutation charges rent on
 * every live input. That was a fact about the world, not about intelligence. Each knob in
 * SHOWCASE_OCEAN exists to take one of those excuses away; the Conditions dialog can put any of
 * them back, and the ladder collapses again when you do.
 *
 * Captions carry the honest finding and must not be softened. Distance still barely pays: knowing
 * something is near does not tell you where to go, and no world we tried changed that.
 */

import type { WorldConfig } from './types';

/** Six accent hexes for world colour-coding: slate · indigo · teal · amber · coral · violet. */
export const ACCENTS = ['#64748b', '#4f56d3', '#0e9488', '#d88a2c', '#e8604c', '#8a5ad8'];

/**
 * The ocean the default bench runs in — every one of these settings exists because a sense
 * could not otherwise earn its keep. They are world properties, never fish behavior: nothing
 * about how a fish swims is programmed, here or anywhere.
 */
export const SHOWCASE_OCEAN = {
	/** The shark no longer gets faster and wider-jawed until it kills: a fish that learned is
	 *  allowed to look safe, instead of everyone dying at the same rate regardless. */
	persistence: false,
	/** The strike locks its vector at launch and pays a recovery when it misses, so a dodge
	 *  visibly works and the shark sails past. (Reference: re-aims every frame — undodgeable.) */
	lungeCommit: true,
	/** It CHARGES while winding up instead of coiling, so closing speed rises ahead of a strike
	 *  and can predict it. (Reference: brakes to a crawl — the sense reads "safe" as it lunges.) */
	aimCharge: true,
	lungeFerocity: 1.6,
	/** No free wall-avoidance force. Corners are a real trap now, and only a fish that can SENSE
	 *  walls learns to stay out of them — which is what makes that sense worth its noise. */
	wallInstinct: false,
	/** THE ONE THAT UNLOCKED AWARENESS: cruise 140 px/s, below the fish's own 176 top speed. Above
	 *  it, a perfectly-informed fish is still run down, so knowing buys a delay and never an escape. */
	predSpeed: 0.7,
	/** The shark eats whoever is NEAREST, so in a crowd a smart fish is spared because a dumber
	 *  neighbour was closer. A third hunter means your own competence is what saves you. */
	preds: 3,
	/** Every decent fish survived the reference's 10s by generation 30, so selection ran out of
	 *  anything to sort. Thirty seconds keeps the gradient alive for 150 generations. */
	genDuration: 30,
	/** The body can express what the brain decided — a sharper chassis, the same evolved policy. */
	agility: 1.4
} as const satisfies Partial<WorldConfig>;

const TANK = { prey: 20, bw: 640, bh: 400, vision: 200, mutation: 0.06 };

/**
 * The five default worlds — one more sense each, in the order the MEASUREMENTS say they pay.
 *
 * Walls comes before closing speed on purpose: measured in this ocean, walls adds +11% on top of
 * direction while closing-next-to-direction is still a net tax, and only stacks positively once
 * everything else is in place. The ladder is ordered by what is true, not by what would read well.
 */
export const DEFAULT_WORLDS: WorldConfig[] = [
	{
		name: 'Blind drift',
		accent: '#64748b',
		...TANK,
		...SHOWCASE_OCEAN,
		senses: { dist: false, dir: false, closing: false, walls: false },
		caption:
			'No predator input reaches these brains at all, so natural selection has nothing to work with. They drift, they blunder into the sharks, and the population is culled to almost nothing.'
	},
	{
		name: 'Distance',
		accent: '#4f56d3',
		...TANK,
		...SHOWCASE_OCEAN,
		senses: { dist: true, dir: false, closing: false, walls: false },
		caption:
			'One input: how close danger is. They learn to bolt when it nears, but blind to direction, half of them bolt straight into the jaws. It barely beats sensing nothing at all.'
	},
	{
		name: 'Direction',
		accent: '#0e9488',
		...TANK,
		...SHOWCASE_OCEAN,
		senses: { dist: true, dir: true, closing: false, walls: false },
		caption:
			'Add the direction it is coming from, and they finally flee the right way. And because this shark is slower than they are, fleeing the right way now means getting away. The biggest single jump on the bench.'
	},
	{
		name: 'Corner-wise',
		accent: '#e8604c',
		...TANK,
		...SHOWCASE_OCEAN,
		senses: { dist: true, dir: true, closing: false, walls: true },
		caption:
			'These fish have no instinct to avoid walls; nothing here does. Give them wall sensors and they learn to stop cornering themselves, which is where a fleeing fish otherwise dies.'
	},
	{
		name: 'Full senses',
		accent: '#d88a2c',
		...TANK,
		...SHOWCASE_OCEAN,
		senses: { dist: true, dir: true, closing: true, walls: true },
		caption:
			'Everything switched on, closing speed included: they feel the lunge coming and cut away early, and the shark, committed to its strike, sails right past. The top of the ladder, and it had to be earned one danger at a time.'
	}
];

/**
 * The world a fresh "+ Add world" starts from: the standard tank, every sense switched on, and no
 * story caption yet. It is a factory, not a constant, so two new worlds can never end up sharing
 * one `senses` object. New worlds are born in the default ocean, the one where senses pay.
 */
export function newWorldConfig(name: string, accent: string): WorldConfig {
	return {
		name,
		accent,
		...TANK,
		...SHOWCASE_OCEAN,
		senses: { dist: true, dir: true, closing: true, walls: true },
		caption: ''
	};
}

/**
 * The range each condition may be set to — the bounds of the experiment.
 *
 * These come from the product (the reference's Conditions dialog), not from the tuning constants:
 * they say what a user is allowed to ask for, not what the science is calibrated to. They live here
 * so the sliders that offer a range and the store that clamps to it cannot drift apart.
 *
 * `step` is the increment the UI moves in — ±2 prey at a time (a population of odd size breeds
 * awkwardly), ±1 predator, and fine enough steps on the continuous knobs to feel analogue.
 *
 * `predSpeed` reaches BELOW 1 on purpose, and that is the most consequential slider on the bench:
 * a fish tops out at 176 px/s and the shark cruises at 200 × this number, so somewhere around 0.88
 * the shark stops being able to run a fish down — and every sense the fish owns suddenly matters.
 */
/*
 * WHAT WAS MEASURED WHEN WE TRIED TO "RAISE THE STAKES" — kept, because the finding cost a day and
 * the button it produced did not survive review. There is no preset any more: crowding the ocean is
 * just the predator and vision sliders, and a button that only moves two sliders is a button that
 * hides where the change came from. Raise them by hand.
 *
 * Five candidate oceans, 50 generations × 3 seeds, scored on mean life and on the assay's turn
 * accuracy:
 *
 *   • SLOWING THE SHARK DOWN — so that fleeing "genuinely works" — DESTROYS the ladder. Blind fish
 *     live 5.55s and bearing fish 5.32s: when everybody survives, selection has nothing left to
 *     sort. Mercy is not pressure, and this was the obvious idea.
 *   • A fiercer strike sharpens survival (+39%) and barely moves the decision (+3 points).
 *   • MORE HUNTERS AND LONGER SIGHT is what works: the blind-vs-bearing survival gap widens from
 *     +34% to +67%, and the share of fish turning the right way climbs 51% → 64%.
 *   • …AND IT COLLAPSES THE RUNGS ABOVE BEARING. Full-sense fish fall below corner-wise ones, and no
 *     milder version kept the ladder monotone. A harsher world does not make MORE senses pay: it
 *     makes ONE sense decisive and drowns the rest. That is the thesis, one level up.
 *
 * ⚠️ THOSE NUMBERS WERE TAKEN BEFORE THE DOUBLE-PREDATOR BUG WAS FOUND (a frozen bout ran against
 * twice the sharks its config asked for — see behavior.ts). The DIRECTION of every one of them is
 * safe, because every world was equally over-hunted; the magnitudes are not. Re-measure before
 * quoting them.
 */

export const WORLD_LIMITS = {
	prey: { min: 2, max: 80, step: 2 },
	/* Raised from 6: the owner's point, and a good one — "crowd the ocean" is not a feature, it is
	   this slider. A bench that wants to know what five or eight hunters does to the ladder should be
	   able to just ask, without a button standing between the question and the answer. */
	preds: { min: 0, max: 10, step: 1 },
	bw: { min: 320, max: 1300, step: 10 },
	bh: { min: 220, max: 860, step: 10 },
	predSpeed: { min: 0.4, max: 1.8, step: 0.05 },
	/* The agent's top speed. Centred on the reference's 176 so the default world is unchanged, with
	   headroom either side to drive the crossover against the predator's cruise. */
	maxSpeed: { min: 80, max: 300, step: 4 },
	vision: { min: 120, max: 280, step: 5 },
	mutation: { min: 0, max: 0.2, step: 0.005 },
	/** Persistence params — only meaningful while the hunger ramp is switched ON. */
	persistRamp: { min: 0.01, max: 0.12, step: 0.01 },
	persistMaxBoost: { min: 0.1, max: 1.5, step: 0.05 },
	persistMaxJaw: { min: 0, max: 40, step: 2 }
} as const satisfies Record<string, { min: number; max: number; step: number }>;

/** The numeric conditions a user may edit — the keys of WORLD_LIMITS. */
export type NumericCondition = keyof typeof WORLD_LIMITS;

/** What the persistence params fall back to when the ramp is switched on (the reference's own). */
export const PERSISTENCE_DEFAULTS = {
	persistRamp: 0.04,
	persistMaxBoost: 0.85,
	persistMaxJaw: 20
} as const;

/**
 * What each accent is called, for anyone who cannot see it.
 *
 * The swatch row in the Conditions dialog is a set of coloured circles; without this its accessible
 * name would be the raw hex, which a screen reader spells out as "hash four eff five six dee three".
 */
export const ACCENT_NAMES: Record<string, string> = {
	'#64748b': 'slate',
	'#4f56d3': 'indigo',
	'#0e9488': 'teal',
	'#d88a2c': 'amber',
	'#e8604c': 'coral',
	'#8a5ad8': 'violet'
};

/**
 * How long training lasts before a world is deployed — the bench-wide "max generations".
 *
 * Deployment is the product's second act: evolution stops, and the population you bred has to
 * survive on its own with no more generations to save it. `0` means never deploy — the bench just
 * keeps evolving, which is the right setting while you are still experimenting.
 */
export const MAX_GENERATIONS = { min: 0, max: 150, step: 5 } as const satisfies {
	min: number;
	max: number;
	step: number;
};

/** What the bench opens with. Separate from the range above so it can be spread into a Slider,
 * whose props are exactly {min, max, step} — a fourth field would ride along unused. */
export const MAX_GENERATIONS_DEFAULT = 150;
