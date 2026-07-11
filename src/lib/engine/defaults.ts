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
