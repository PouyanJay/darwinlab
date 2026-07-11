/**
 * The seeded bench — the "sense ladder" (README §8) — and the world accent palette.
 * Ported verbatim from engine2.js. Captions carry the honest finding and must not be
 * softened: more senses ≠ more intelligence.
 */

import type { WorldConfig } from './types';

/** Six accent hexes for world colour-coding: slate · indigo · teal · amber · coral · violet. */
export const ACCENTS = ['#64748b', '#4f56d3', '#0e9488', '#d88a2c', '#e8604c', '#8a5ad8'];

/** The five default worlds, adding one sense at a time to expose where survival actually leaps. */
export const DEFAULT_WORLDS: WorldConfig[] = [
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
			'Add which-way, and survival leaps. This is the sense that actually pays off — the single biggest jump on the whole bench.'
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
			'Now pile closing-speed on top — more information for the brain. But watch: survival does not climb to match. An input the environment never rewards is just noise the search has to fight through.'
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
			'All four senses switched on. Compare it to Direction: barely different. More sensors are not more intelligence — the world has to make each one earn its keep, and here most do not.'
	}
];

/**
 * The world a fresh "+ Add world" starts from: the standard tank, every sense switched on, and no
 * story caption yet. Ported from the reference's `addWorld`. It is a factory, not a constant, so
 * two new worlds can never end up sharing one `senses` object.
 */
export function newWorldConfig(name: string, accent: string): WorldConfig {
	return {
		name,
		accent,
		prey: 20,
		preds: 2,
		bw: 640,
		bh: 400,
		predSpeed: 1,
		vision: 200,
		mutation: 0.06,
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
 */
export const WORLD_LIMITS = {
	prey: { min: 2, max: 80, step: 2 },
	preds: { min: 0, max: 6, step: 1 },
	bw: { min: 320, max: 1300, step: 10 },
	bh: { min: 220, max: 860, step: 10 },
	predSpeed: { min: 0.6, max: 1.8, step: 0.05 },
	vision: { min: 120, max: 280, step: 5 },
	mutation: { min: 0, max: 0.2, step: 0.005 }
} as const satisfies Record<string, { min: number; max: number; step: number }>;

/** The numeric conditions a user may edit — the keys of WORLD_LIMITS. */
export type NumericCondition = keyof typeof WORLD_LIMITS;

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
export const MAX_GENERATIONS = { min: 0, max: 150, step: 5, default: 150 } as const;
