/**
 * The seeded bench — the sense ladder — plus the reference bench it replaced, and the accent
 * palette.
 *
 * WHY THERE ARE TWO BENCHES. The original (reference) worlds run in an ocean where no sense can
 * pay: the shark outruns every fish (so knowing which way to flee only delays death), it re-aims
 * mid-lunge (so no dodge works), every fish avoids walls by a FREE instinct (so wall-sensing
 * solves a problem it does not have), and it brakes to wind up (so closing speed is at its lowest
 * exactly when the strike is coming). Measured, that world is brutal: a fish with ALL FOUR senses
 * survives 5% LESS than a blind one, because mutation taxes every live input and none of them buy
 * anything. That is not a fact about intelligence — it is a broken world, and we keep it, because
 * showing it next to a working one is the whole lesson.
 *
 * The default bench gives every sense a real job, and then the ladder climbs honestly:
 *   blind 3.18s · +distance 3.33s · +direction 4.43s · +walls 4.78s · +closing (all four) 5.46s
 * (mean life per fish, 3 evolution seeds × 12 seeded bouts — scripts/sweep-senses.ts).
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
			'One input: how close danger is. They learn to bolt when it nears — but blind to direction, half of them bolt straight into the jaws. It barely beats sensing nothing at all.'
	},
	{
		name: 'Direction',
		accent: '#0e9488',
		...TANK,
		...SHOWCASE_OCEAN,
		senses: { dist: true, dir: true, closing: false, walls: false },
		caption:
			'Add the direction it is coming from, and they finally flee the right way — and because this shark is slower than they are, fleeing the right way now means getting away. The biggest single jump on the bench.'
	},
	{
		name: 'Corner-wise',
		accent: '#e8604c',
		...TANK,
		...SHOWCASE_OCEAN,
		senses: { dist: true, dir: true, closing: false, walls: true },
		caption:
			'These fish have no instinct to avoid walls — nothing here does. Give them wall sensors and they learn to stop cornering themselves, which is where a fleeing fish otherwise dies.'
	},
	{
		name: 'Full senses',
		accent: '#d88a2c',
		...TANK,
		...SHOWCASE_OCEAN,
		senses: { dist: true, dir: true, closing: true, walls: true },
		caption:
			'Everything switched on, closing speed included: they feel the lunge coming and cut away early, and the shark — committed to its strike — sails right past. The top of the ladder, and it had to be earned one danger at a time.'
	}
];

/**
 * The ORIGINAL bench, kept as a preset: the ocean where no sense can pay.
 *
 * Load it and measure: a fish with all four senses survives ~5% LESS than a blind one. Every
 * input is live, none of them buys anything, and mutation charges rent on all of them. It is the
 * sharpest exhibit the lab has — "more senses" is worse than useless when the world ignores them —
 * and it is also the configuration the fidelity gate holds bit-identical to the original engine.
 */
export const REFERENCE_WORLDS: WorldConfig[] = [
	{
		name: 'Blind drift',
		accent: '#64748b',
		prey: 20,
		preds: 2,
		bw: 640,
		bh: 400,
		predSpeed: 1,
		vision: 200,
		mutation: 0.06,
		senses: { dist: false, dir: false, closing: false, walls: false },
		caption:
			'No predator input reaches these brains at all, so natural selection has nothing to work with. The population is culled to almost nothing — and never really recovers.'
	},
	{
		name: 'Distance',
		accent: '#4f56d3',
		prey: 20,
		preds: 2,
		bw: 640,
		bh: 400,
		predSpeed: 1,
		vision: 200,
		mutation: 0.06,
		senses: { dist: true, dir: false, closing: false, walls: false },
		caption:
			'One input: how close danger is. Fish learn to bolt when threatened — but with no sense of which way, they bolt blindly, so it barely beats sensing nothing at all.'
	},
	{
		name: 'Direction',
		accent: '#0e9488',
		prey: 20,
		preds: 2,
		bw: 640,
		bh: 400,
		predSpeed: 1,
		vision: 200,
		mutation: 0.06,
		senses: { dist: true, dir: true, closing: false, walls: false },
		caption:
			'Add which-way, and survival climbs a little. In this ocean the shark still outruns them, so knowing where it is only ever delays the end.'
	},
	{
		name: 'Anticipation',
		accent: '#d88a2c',
		prey: 20,
		preds: 2,
		bw: 640,
		bh: 400,
		predSpeed: 1,
		vision: 200,
		mutation: 0.06,
		senses: { dist: true, dir: true, closing: true, walls: false },
		caption:
			'Closing speed piled on top — more information, and survival does not climb to match. This shark brakes to wind up, so closing speed reads its lowest just as the strike comes: the input is not merely useless here, it is misleading.'
	},
	{
		name: 'Corner-wise',
		accent: '#e8604c',
		prey: 20,
		preds: 2,
		bw: 640,
		bh: 400,
		predSpeed: 1,
		vision: 200,
		mutation: 0.06,
		senses: { dist: true, dir: true, closing: true, walls: true },
		caption:
			'All four senses on — and measured, these fish do WORSE than blind ones. They already dodge walls by instinct, so the wall sense buys nothing, and every live input costs mutation rent. A sense the world ignores is worse than no sense at all.'
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
export const WORLD_LIMITS = {
	prey: { min: 2, max: 80, step: 2 },
	preds: { min: 0, max: 6, step: 1 },
	bw: { min: 320, max: 1300, step: 10 },
	bh: { min: 220, max: 860, step: 10 },
	predSpeed: { min: 0.4, max: 1.8, step: 0.05 },
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
