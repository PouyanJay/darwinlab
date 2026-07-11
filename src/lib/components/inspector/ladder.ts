/**
 * The intelligence ladder: which rung the senses a world gives its brains can reach.
 *
 * A brain cannot integrate information it never receives, so the rung follows from the inputs, not
 * from how well the fish happens to be doing. The ladder tops out at "prediction" no matter what
 * you switch on — the rungs above it (memory, within-life learning, collective) need machinery this
 * network does not have, and pretending otherwise would be the exact flattery this product refuses.
 *
 * Extracted from the panel because the senses are independently toggleable in the Conditions dialog
 * and the combinations are not obvious: a world with DIRECTION but no distance is a reachable state,
 * and it is not a reflex — the brain is being told which way the threat is, which is the one sense
 * the whole product says pays.
 */

import type { Senses } from '$lib/engine';

export const RUNGS = [
	'reflex',
	'tuned reflex',
	'sensor integration',
	'prediction',
	'memory',
	'within-life learning',
	'collective'
] as const;

export function rungFor(senses: Senses): number {
	// Closing speed is the only input that carries the FUTURE in it — where the predator will be, not
	// merely where it is. That is what makes it the prediction rung.
	if (senses.closing) return 3;

	const threatSenses = [senses.dist, senses.dir].filter(Boolean).length;
	if (threatSenses === 2) return 2; // two channels to combine: sensor integration
	if (threatSenses === 1) return 1; // one channel, tuned by evolution: a tuned reflex
	return 0; // no predator input reaches these brains at all — whatever they do is a reflex
}
