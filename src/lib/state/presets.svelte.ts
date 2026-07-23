/**
 * Named base presets — the durable form of the editable subject base.
 *
 * The analysed subject is deliberately session-only (see app.svelte.ts); a PRESET is the owner's
 * explicit "keep this world", so presets persist in localStorage. Saving snapshots the CURRENT base
 * under its name (subject or generic alike — whatever the console is pointed at is what you keep);
 * applying adopts the preset as the editable generic through `app.adoptBase`, which also drops any
 * analysed subject — a preset IS the new base, not an overlay.
 */

import { browser } from '$app/environment';
import type { WorldConfig } from '../engine';
import { app } from './app.svelte';

export const PRESETS_STORAGE_KEY = 'darwinlab:base-presets';
const STORAGE_VERSION = 1;

/** Newest-first cap — the rail is a list of favourites, not an archive. */
const MAX_PRESETS = 12;

export interface BasePreset {
	name: string;
	cfg: WorldConfig;
}

/** The minimal shape check a stored entry must pass — garbage in storage is dropped, not thrown. */
function isPreset(value: unknown): value is BasePreset {
	if (typeof value !== 'object' || value === null) return false;
	const preset = value as Partial<BasePreset>;
	return (
		typeof preset.name === 'string' &&
		typeof preset.cfg === 'object' &&
		preset.cfg !== null &&
		typeof (preset.cfg as WorldConfig).prey === 'number' &&
		typeof (preset.cfg as WorldConfig).senses === 'object'
	);
}

export function loadPresets(): BasePreset[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.entries)) return [];
		return (parsed.entries as unknown[]).filter(isPreset).slice(0, MAX_PRESETS);
	} catch {
		return [];
	}
}

class PresetsStore {
	#entries = $state.raw<BasePreset[]>(loadPresets());

	/** Every saved preset, newest first. */
	get entries(): BasePreset[] {
		return this.#entries;
	}

	#persist(): void {
		if (!browser) return;
		localStorage.setItem(
			PRESETS_STORAGE_KEY,
			JSON.stringify({ version: STORAGE_VERSION, entries: this.#entries })
		);
	}

	/**
	 * Snapshot the current base under its own name. Saving again under the same name replaces the
	 * old snapshot — a preset is "the world called X", not a history of it.
	 *
	 * The copy is defence-in-depth, not a testable guard: today no code path mutates a config in
	 * place (the app store replaces, never mutates — sabotaging this copy fails no test), but a
	 * preset is PERSISTED, so a future in-place mutation anywhere would otherwise corrupt saved
	 * worlds silently. One spread is cheap insurance across that module boundary.
	 */
	saveCurrent(): void {
		const base = app.base;
		const snapshot: BasePreset = { name: base.name, cfg: { ...base, senses: { ...base.senses } } };
		this.#entries = [snapshot, ...this.#entries.filter((p) => p.name !== base.name)].slice(
			0,
			MAX_PRESETS
		);
		this.#persist();
	}

	/**
	 * Adopt a preset as the editable base (drops any analysed subject — see app.adoptBase). A miss
	 * is a deliberate no-op, not a throw: unlike a bench id (always a caller bug), a preset name can
	 * arrive from stale UI or another tab's deletion — data, not a bug.
	 */
	apply(name: string): void {
		const preset = this.#entries.find((p) => p.name === name);
		if (preset) app.adoptBase(preset.cfg);
	}

	remove(name: string): void {
		this.#entries = this.#entries.filter((p) => p.name !== name);
		this.#persist();
	}
}

export const presets = new PresetsStore();
