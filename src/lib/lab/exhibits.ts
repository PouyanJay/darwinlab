/**
 * The exhibits — the world SETS the bench can be pointed at. Each is a self-contained experiment
 * with its own ocean and its own question, and switching between them re-launches the bench with a
 * different roster (see bench.loadExhibit). The scenario vocabulary (agents, adversary, observation
 * space) is shared; what changes is which worlds are on the table.
 *
 *   Sense ladder — the founding experiment: one sense added at a time, in the order they pay.
 *   The Shoal    — schooling: the SAME ocean and brain, ablated only on whether the fish sense each
 *                  other, so a swarm appears in one tank and not the other. Nobody writes the flocking.
 */

import { DEFAULT_WORLDS, SHOAL_WORLDS, MAX_GENERATIONS_DEFAULT } from '$lib/engine';
import type { WorldConfig } from '$lib/engine';
import { PREWARM_GENERATIONS } from './scenario';

export interface Exhibit {
	id: string;
	/** What the switcher calls it. */
	name: string;
	/** One line under the switcher — the question this exhibit is an instrument for. */
	blurb: string;
	configs: WorldConfig[];
	/** Generations to evolve before the first paint, so it opens on competent agents. */
	prewarmGenerations: number;
	maxGenerations: number;
}

export const EXHIBITS: Exhibit[] = [
	{
		id: 'senses',
		name: 'Sense ladder',
		blurb: 'What is a sense worth, when the world decides whether it can be used?',
		configs: DEFAULT_WORLDS,
		prewarmGenerations: PREWARM_GENERATIONS,
		maxGenerations: MAX_GENERATIONS_DEFAULT
	},
	{
		id: 'shoal',
		name: 'The Shoal',
		// The Shoal needs longer to converge than the sense ladder — the swarm tightens over
		// generations, so it opens further along or the first paint is just twenty scattered fish.
		blurb: 'Does a school appear on its own, when grouping is what keeps you alive?',
		configs: SHOAL_WORLDS,
		prewarmGenerations: 55,
		maxGenerations: MAX_GENERATIONS_DEFAULT
	}
];

/** The exhibit the bench opens on. */
export const DEFAULT_EXHIBIT = EXHIBITS[0];
