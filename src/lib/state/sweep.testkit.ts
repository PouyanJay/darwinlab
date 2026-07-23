/**
 * Test helpers for the sweep design — the singleton walk-backs both the store spec and the panel
 * spec need (the common/testkit.ts precedent: shared test support beside the code it supports).
 * One source of truth for "what the panel's defaults are", so the two specs cannot drift.
 */

import { sweep } from './sweep.svelte';
import { app } from './app.svelte';

/** Walk every knob and the budget back to the catalog defaults, and the app to a fresh base. */
export function restoreSweepDefaults(): void {
	app.clearSubject();
	app.resetBase();
	for (const knob of sweep.boolKnobs) sweep.setBoolState(knob.key, knob.defaultState);
	for (const knob of sweep.gradedKnobs) {
		for (const value of knob.values) {
			const want = knob.defaultSelected.includes(value);
			if (sweep.isLevelSelected(knob.key, value) !== want) sweep.toggleLevel(knob.key, value);
		}
	}
	sweep.setSeeds(6);
	sweep.setEpisodes(20);
	sweep.setGenDuration(10);
	sweep.setCapOn(false);
	sweep.setCapN(32);
}

/** Collapse every knob to a single pinned value — the zero-factor, one-cell design. */
export function pinEveryKnob(): void {
	for (const knob of sweep.boolKnobs) {
		if (sweep.boolState(knob.key) === 'sweep') sweep.setBoolState(knob.key, 'on');
	}
	for (const knob of sweep.gradedKnobs) {
		// make sure the keeper chip is on FIRST, so deselecting the rest never hits the last-chip rule
		if (!sweep.isLevelSelected(knob.key, knob.defaultSelected[0]))
			sweep.toggleLevel(knob.key, knob.defaultSelected[0]);
		for (const value of knob.values) {
			if (sweep.isLevelSelected(knob.key, value) && value !== knob.defaultSelected[0])
				sweep.toggleLevel(knob.key, value);
		}
	}
}
