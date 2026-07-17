/**
 * The shell: how the app's chrome is arranged, as opposed to what the simulation is doing.
 *
 * It owns the sidebar — whether it is open — and nothing else. Kept OUT of the bench store on
 * purpose: opening the controls must never look like a reason to touch a world.
 *
 * The panel is ONE fixed width. It is designed at that width; letting a divider drag it narrower or
 * wider only ever made the column look worse, and "make it smaller" is already the collapse, which
 * leaves a working rail rather than a squeezed panel. So the only sidebar preference worth
 * remembering is open-vs-collapsed.
 *
 * Two different questions hide behind "is the sidebar open", and conflating them is the bug this
 * store exists to avoid:
 *
 *   • on a desktop the sidebar is DOCKED, and `collapsed` is a preference worth remembering;
 *   • on a phone there is no room to dock anything, so the panel is an OVERLAY that starts shut and
 *     stays session-local. Restoring a remembered "expanded" there would open the app with the
 *     controls sitting on top of the bench.
 *
 * So the remembered preference is only ever consulted on the wide layout, and `open` is the one
 * answer the UI asks for.
 */

import { browser } from '$app/environment';

export const SIDEBAR_STORAGE_KEY = 'darwinlab:sidebar';

/** Narrower than this and there is no room to dock a panel beside the bench. */
export const NARROW_QUERY = '(max-width: 900px)';

/** The one width the docked panel is drawn at — see the note at the top of this file. */
export const SIDEBAR_WIDTH = 300;

function loadCollapsed(): boolean {
	if (!browser) return false;
	try {
		const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY);
		if (!raw) return false;
		return (JSON.parse(raw) as { collapsed?: unknown }).collapsed === true;
	} catch {
		// A corrupt or unreadable entry is not worth a broken shell — open at the default.
		return false;
	}
}

class ShellStore {
	/** The DOCKED preference — persisted, and only honoured on the wide layout. */
	#collapsed = $state(false);
	/** Is the viewport too narrow to dock? Tracked, not guessed: the CSS asks the same question. */
	#narrow = $state(false);
	/** Narrow layout only: the panel is showing OVER the bench. Session-local, starts shut. */
	#overlayOpen = $state(false);

	/** The panel's width — fixed, so callers can size off it without being able to change it. */
	get width(): number {
		return SIDEBAR_WIDTH;
	}
	get collapsed(): boolean {
		return this.#collapsed;
	}
	get narrow(): boolean {
		return this.#narrow;
	}
	get overlayOpen(): boolean {
		return this.#overlayOpen;
	}

	/** Whether the full panel is showing, on whichever layout we are in. */
	get open(): boolean {
		return this.#narrow ? this.#overlayOpen : !this.#collapsed;
	}

	/**
	 * The panel is COVERING the bench rather than sitting beside it.
	 *
	 * What floats over the bench (the disclaimer, the first-run hint) is pinned to the viewport and
	 * layered above it, so it would otherwise punch straight through the panel and its scrim — a
	 * pill about the tanks, printed on top of the controls that hide them.
	 */
	get overlaying(): boolean {
		return this.#narrow && this.#overlayOpen;
	}

	/** Adopt what was saved and start watching the viewport. Returns its teardown. */
	init(): () => void {
		this.#collapsed = loadCollapsed();

		const media = matchMedia(NARROW_QUERY);
		const sync = () => {
			this.#narrow = media.matches;
			// Growing back to the wide layout retires the overlay: it is a phone affordance, and a
			// leftover `true` would re-open the panel the next time the window shrank.
			if (!media.matches) this.#overlayOpen = false;
		};

		sync();
		media.addEventListener('change', sync);
		return () => media.removeEventListener('change', sync);
	}

	/** Open or shut, in whichever sense this layout means it. */
	toggle(): void {
		if (this.#narrow) {
			this.#overlayOpen = !this.#overlayOpen;
			return;
		}
		this.#collapsed = !this.#collapsed;
		this.#save();
	}

	/** Shut the overlay (Esc, the scrim, or following a control that takes over the screen). */
	closeOverlay(): void {
		this.#overlayOpen = false;
	}

	#save(): void {
		if (!browser) return;
		localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify({ collapsed: this.#collapsed }));
	}
}

export const shell = new ShellStore();
