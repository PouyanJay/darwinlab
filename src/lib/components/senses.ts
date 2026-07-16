/**
 * The four senses, as the UI talks about them.
 *
 * The engine knows these only as boolean flags on `cfg.senses`; the names, the abbreviations on the
 * tile pills, and the one-line explanations are product copy, so they live out here rather than in
 * the engine. The Conditions modal, the Brain Inspector and story mode all read from this list —
 * one place, so the four senses can never be described three different ways.
 *
 * ORDER IS MEANINGFUL: it is the order the default bench switches them on in (README §8), which is
 * the order the lesson is told in — distance, then direction (where survival actually leaps), then
 * the two that don't pay.
 */

import type { Senses } from '$lib/engine';

export interface SenseInfo {
	key: keyof Senses;
	/** The tile pill's cramped label. */
	short: string;
	/** The full name, as the modal and inspector say it. */
	name: string;
	/** What switching it on gives the brain. */
	description: string;
}

export const SENSES: readonly SenseInfo[] = [
	{ key: 'dist', short: 'dist', name: 'Distance', description: 'detect the predator at range' },
	{ key: 'dir', short: 'dir', name: 'Direction', description: 'know which way the threat is' },
	{ key: 'closing', short: 'close', name: 'Closing speed', description: 'feel the lunge building' },
	{ key: 'walls', short: 'walls', name: 'Walls', description: 'sense the container edges' },
	// The shoal senses — of OTHER FISH, not the predator. Present only on schooling worlds, so the
	// pill row shows them only where `cfg.senses` actually carries them (see WorldTile's filter).
	{ key: 'cohesion', short: 'shoal', name: 'Shoal', description: 'sense where the other fish are' },
	{ key: 'align', short: 'align', name: 'Alignment', description: 'feel which way the shoal swims' }
];

/** The senses a given world actually exposes — the four predator senses always, plus any extras
 *  (proprioception, the shoal senses) its `cfg.senses` declares. Used to render the pill row. */
export function sensesFor(senses: Senses): readonly SenseInfo[] {
	return SENSES.filter((s) => s.key in senses);
}
