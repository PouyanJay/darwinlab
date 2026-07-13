/**
 * The observation-subset matrix — what each channel is worth IN A GIVEN ENVIRONMENT.
 *
 * The subsets live here rather than in the component because the answer belongs to the environment,
 * not to the panel that draws it: a channel is worth exactly what its own environment makes it
 * worth. Boundary rays pay in a world that has no free wall-avoidance and are worthless in one that
 * does; bearing pays when the adversary is slow enough to escape and buys nothing when it is not.
 * So a matrix is always run in ONE card's conditions, and the rows below are the only thing that
 * varies across it.
 */

import type { Senses } from '../engine';

export interface AblationSubset {
	label: string;
	senses: Senses;
}

export interface AblationRow {
	label: string;
	/** Mean seconds survived per agent, over frozen populations. */
	mean: number;
	sd: number;
	/** Percent over the blind policy — the comparison that answers "does knowing pay". */
	vsBlind: number;
}

/**
 * The subsets, in the order that makes the argument: nothing, each channel alone, then the
 * combinations. The blind row is FIRST because everything else is measured against it.
 */
export const SUBSETS: AblationSubset[] = [
	{ label: 'blind', senses: { dist: false, dir: false, closing: false, walls: false } },
	{ label: 'range', senses: { dist: true, dir: false, closing: false, walls: false } },
	{ label: 'bearing', senses: { dist: false, dir: true, closing: false, walls: false } },
	{ label: 'range + bearing', senses: { dist: true, dir: true, closing: false, walls: false } },
	{
		label: '+ boundary rays',
		senses: { dist: true, dir: true, closing: false, walls: true }
	},
	{ label: 'all four', senses: { dist: true, dir: true, closing: true, walls: true } }
];
