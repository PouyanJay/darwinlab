/**
 * App mode + the analysis subject — the two things that make Studio and Research one lab.
 *
 * The lab is one place with two modes: STUDIO (watch a world evolve, read one brain) and RESEARCH
 * (run many simulations, extract conclusions). The mode is the highest-level lens over the SAME
 * worlds and the SAME engine — switching it swaps the stage and the controls, never the science.
 * That is why it lives in the top bar, not the sidebar: a mode is identity, not a bench control.
 *
 * The store also owns the analysis SUBJECT — the one piece of state that rides along WITH a mode
 * switch rather than surviving one, because it IS the payload of the switch: "analyse the world I'm
 * watching" (`analyze`) both stashes that world and flips to Research, and every instrument builds
 * its runs on it (`subjectBase`). Mode persists; the subject deliberately does not (see `#subject`).
 *
 * Since the redesign, the store also owns the EDITABLE GENERIC BASE — the world Research explores
 * when nothing is analysed. The subject card edits it directly (population, tank, brain), so
 * building a control world needs no Studio detour. Every instrument still reads ONE base through
 * `subjectBase`.
 *
 * Mode resolves to `studio` on the server / first load (the prerendered SPA has no `window`),
 * adopting the saved value in `init()` once the browser is there — the same shape as the theme store.
 */

import { browser } from '$app/environment';
import {
	newWorldConfig,
	WORLD_LIMITS,
	BRAIN_MAX_LAYERS,
	type NumericCondition,
	type WorldConfig
} from '../engine';

export type AppMode = 'studio' | 'research';

export const MODE_STORAGE_KEY = 'darwinlab:mode';

/** The neutral grey a Research run wears — chrome, since the science ignores name/accent. */
export const RESEARCH_NEUTRAL_ACCENT = '#8b8b8b';

function resolveMode(): AppMode {
	if (!browser) return 'studio';
	return localStorage.getItem(MODE_STORAGE_KEY) === 'research' ? 'research' : 'studio';
}

/** The clamp every base edit passes through — the engine does not validate (see bench.setCondition). */
function clamp(value: number, { min, max }: { min: number; max: number }): number {
	return Math.min(max, Math.max(min, value));
}

/** The name a fresh editable base wears — also what the subject card shows for it. */
const GENERIC_NAME = 'Generic world';

class AppStore {
	#mode = $state<AppMode>('studio');

	// The world Research is exploring around — set by "Analyse in Research" from a Studio world. Null
	// means Research runs on the editable generic base below. `$state.raw`: it is a whole config, only
	// ever replaced, never mutated in place. Deliberately NOT persisted — a subject is a live hand-off
	// from the world you were just watching, not a setting to restore into an empty next session.
	#subject = $state.raw<WorldConfig | null>(null);

	// The EDITABLE generic base — the world Research explores when nothing is analysed. The subject
	// card edits this in place (population, tank, brain), so "build the control right here" needs no
	// Studio detour. Same replace-never-mutate discipline as the subject; session-only on purpose
	// (presets are the durable form).
	#generic = $state.raw<WorldConfig>(newWorldConfig(GENERIC_NAME, RESEARCH_NEUTRAL_ACCENT));

	/** Adopt the persisted mode. Called once the browser is present (onMount). */
	init(): void {
		this.setMode(resolveMode());
	}

	get mode(): AppMode {
		return this.#mode;
	}

	/** True in Research — the one flag the shell branches on. */
	get research(): boolean {
		return this.#mode === 'research';
	}

	/** Switch instruments. Persists, and leaves the live bench untouched. */
	setMode(mode: AppMode): void {
		this.#mode = mode;
		if (browser) localStorage.setItem(MODE_STORAGE_KEY, mode);
	}

	/** The world Research is currently analysing, or null when it explores a generic world. */
	get subject(): WorldConfig | null {
		return this.#subject;
	}

	/**
	 * Carry a Studio world into Research: seed it as the subject and switch modes. This is the
	 * Studio→Research half of the round-trip (the mirror of the Atlas's `watch`), the move that makes
	 * "analyse the world I was just watching" one click instead of a manual reconstruction.
	 */
	analyze(cfg: WorldConfig): void {
		this.#subject = cfg;
		this.setMode('research');
	}

	/** Drop the subject — Research goes back to the editable generic base (edits intact). */
	clearSubject(): void {
		this.#subject = null;
	}

	/**
	 * The base the console is pointed at RIGHT NOW — the analysed subject when one is set, otherwise
	 * the editable generic. This is what the subject card reads and what every edit below writes.
	 */
	get base(): WorldConfig {
		return this.#subject ?? this.#generic;
	}

	/** Route one edit at whichever config is the current base — replace, never mutate ($state.raw). */
	#editBase(change: (cfg: WorldConfig) => WorldConfig): void {
		if (this.#subject) this.#subject = change(this.#subject);
		else this.#generic = change(this.#generic);
	}

	/**
	 * Edit one numeric condition of the base, clamped to WORLD_LIMITS on the way in — the same door
	 * Studio's Conditions dialog uses (bench.setCondition), because a 40px tank or -3 prey is not an
	 * experiment, it is a crash.
	 */
	setBaseCondition(key: NumericCondition, value: number): void {
		if (!Number.isFinite(value)) return; // an emptied number input is not an edit
		this.#editBase((cfg) => ({ ...cfg, [key]: clamp(value, WORLD_LIMITS[key]) }));
	}

	/**
	 * Set the base brain's hidden ARCHITECTURE, same clamps as bench.setBrainLayers: each layer's
	 * size to WORLD_LIMITS.brainHidden, the layer count to BRAIN_MAX_LAYERS, never zero layers.
	 */
	setBaseBrainLayers(layers: number[]): void {
		const clean = layers
			.filter((n) => Number.isFinite(n))
			.slice(0, BRAIN_MAX_LAYERS)
			.map((n) => clamp(Math.round(n), WORLD_LIMITS.brainHidden));
		this.#editBase((cfg) => ({
			...cfg,
			brainHidden: clean.length ? clean : [WORLD_LIMITS.brainHidden.min]
		}));
	}

	/**
	 * The base brain's INPUT slots: 8 (the reference wiring) or 9 (adds the proprioceptive slot the
	 * own-speed sense needs). Dropping to 8 strips the `speed` sense flag — a 9th-slot sense cannot
	 * exist on a brain with no 9th wire (the same discipline bench.setSchooling applies).
	 */
	setBaseBrainInputs(inputs: 8 | 9): void {
		this.#editBase((cfg) => {
			const senses = { ...cfg.senses };
			if (inputs === 8) delete senses.speed;
			return { ...cfg, brainInputs: inputs === 8 ? undefined : inputs, senses };
		});
	}

	/** Rename the base — chrome only (instruments relabel per-run), but it is what the card shows. */
	renameBase(name: string): void {
		const clean = name.trim();
		if (clean) this.#editBase((cfg) => ({ ...cfg, name: clean }));
	}

	/** Throw away the generic base's edits and start from the factory generic again. */
	resetBase(): void {
		this.#generic = newWorldConfig(GENERIC_NAME, RESEARCH_NEUTRAL_ACCENT);
	}

	/** Replace the editable generic wholesale — the presets store's door for "apply this preset". */
	adoptBase(cfg: WorldConfig): void {
		this.#subject = null; // a preset IS the new base, not an overlay on an analysed subject
		this.#generic = { ...cfg, senses: { ...cfg.senses } };
	}

	/**
	 * The base config a Research instrument builds its runs on: the current base, relabelled for the
	 * instrument (name/accent are chrome the science ignores). One source, so the Sweep, the Ledger
	 * and the Atlas all explore the SAME subject — now including the card's edits. The senses object
	 * is copied per hand-out so no instrument can reach back and mutate the stored base through it.
	 */
	subjectBase(label: string, accent: string = RESEARCH_NEUTRAL_ACCENT): WorldConfig {
		const src = this.base;
		return { ...src, senses: { ...src.senses }, name: label, accent };
	}
}

export const app = new AppStore();
