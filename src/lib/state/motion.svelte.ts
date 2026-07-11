/**
 * Reduced-motion preference, as LIVE reactive state.
 *
 * The CSS side honours `prefers-reduced-motion` via a media query, which updates the moment the
 * user changes the setting. The canvas can't use a media query, so it needs the same signal as a
 * value — and it must be a subscription, not a one-time snapshot, or the tank would keep flicking
 * tails and pulsing signals at a user who just asked it to stop.
 */

import { browser } from '$app/environment';
import { createSubscriber } from 'svelte/reactivity';

const QUERY = '(prefers-reduced-motion: reduce)';

function createReducedMotion() {
	if (!browser) return () => false;

	const media = matchMedia(QUERY);
	const subscribe = createSubscriber((update) => {
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	});

	return () => {
		subscribe();
		return media.matches;
	};
}

const read = createReducedMotion();

/** Reactive: reading this inside a component re-runs when the OS preference changes. */
export function prefersReducedMotion(): boolean {
	return read();
}
