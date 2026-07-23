/**
 * Test helpers for the landscape design — the singleton walk-backs the store spec and the panel
 * spec share (the sweep.testkit precedent). One source of truth for "what the panel's defaults
 * are", so the two specs cannot drift.
 */

import { landscape } from './landscape.svelte';
import { app } from './app.svelte';
import { CANDIDATE_AXES, LANDSCAPE_DEFAULTS } from '../lab/landscape';

/** Walk the axes, spans, budget, pins and selection back to the catalog defaults, and the app to a
 *  fresh base. */
export function restoreLandscapeDefaults(): void {
	app.clearSubject();
	app.resetBase();
	landscape.setX('predSpeed');
	landscape.setY('mutation');
	for (const axis of CANDIDATE_AXES) landscape.setSpan(axis.key, axis.min, axis.max);
	landscape.setResolution(LANDSCAPE_DEFAULTS.resolution);
	landscape.setSeeds(LANDSCAPE_DEFAULTS.seeds);
	landscape.setEpisodes(LANDSCAPE_DEFAULTS.episodes);
	landscape.clearPins();
	landscape.clearSelection();
}
