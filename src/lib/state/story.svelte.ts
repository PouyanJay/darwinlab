/**
 * Story mode — the bench, told as a film.
 *
 * One scene per world, in the order they were made, which is the order the argument is made in:
 * blind drift, then distance, then direction (where survival leaps), then the two senses that do
 * not pay. Each scene gets a FRESH full generation seeded from that world's evolved brains
 * (`makeStoryWorld`), so a scene opens with twenty competent fish rather than the handful that
 * happened to be alive on the bench when you hit play. It is the same evolved population — just not
 * mid-slaughter.
 *
 * The story world is a world like any other: it steps through `stepWorld` and projects through the
 * same `WorldStats` / `WorldConfigView`, so the tank, the curve and the Brain Inspector all work on
 * it without knowing they are in a film. While a story runs, the BENCH worlds do not step — there is
 * one thing on screen, and it is the one that should be moving.
 */

import { makeStoryWorld, type Senses } from '../engine';
import { makeEntry, type WorldEntry } from './views.svelte';

/** How long a scene plays before it hands over, in sim-seconds. */
export const SCENE_SECONDS = 18;

/** One sense, as the story's left rail presents it. */
export interface SceneSense {
	key: keyof Senses;
	name: string;
	on: boolean;
	/**
	 * On in THIS scene and off in the one before — the thing the scene is actually about. The rail
	 * tags it, because "what changed" is the whole reason the scenes are in this order.
	 */
	isNew: boolean;
}

class StoryStore {
	active = $state(false);
	/** Which scene is on screen, 0-based. */
	index = $state(0);
	/** How long this scene has been playing, in sim-seconds. */
	elapsed = $state(0);
	/** The scene's world — a fresh generation of the source world's evolved brains. */
	entry = $state.raw<WorldEntry | null>(null);

	/** The bench worlds the film is made from. Snapshotted on start: adding a world mid-film is not
	 *  a thing that should re-cut it. */
	#sources: WorldEntry[] = [];

	get total(): number {
		return this.#sources.length;
	}

	get source(): WorldEntry | null {
		return this.#sources[this.index] ?? null;
	}

	/** How far through the current scene, 0–1 — what the progress bar fills to. */
	get progress(): number {
		return Math.min(1, this.elapsed / SCENE_SECONDS);
	}

	get isLastScene(): boolean {
		return this.index >= this.total - 1;
	}

	/**
	 * The senses this world gives its brains, and which of them are NEW since the previous scene.
	 *
	 * That comparison is the argument: each scene adds one input, and the rail tags it so you can
	 * watch what difference (or none) it makes to the fish in front of you.
	 */
	get senses(): SceneSense[] {
		const current = this.source?.config.senses;
		if (!current) return [];
		const previous = this.#sources[this.index - 1]?.config.senses;

		return SENSE_ORDER.map(({ key, name }) => ({
			key,
			name,
			on: current[key],
			isNew: current[key] && !previous?.[key]
		}));
	}

	/** Begin the film. Returns false if there is nothing to tell a story about. */
	start(sources: WorldEntry[]): boolean {
		if (!sources.length) return false;
		this.#sources = [...sources];
		this.active = true;
		this.#cut(0);
		return true;
	}

	exit(): void {
		this.active = false;
		this.entry = null;
		this.#sources = [];
		this.index = 0;
		this.elapsed = 0;
	}

	/**
	 * Jump to a scene. Out-of-range indices are clamped — a film has a first and a last frame —
	 * and a jump to the scene already on screen is NOT a jump: re-cutting it would swap a fresh
	 * world in under a held film without the stage ever repainting (the paint gate only paints
	 * what moved, and the scene remount is keyed on the index, which would not change).
	 */
	goTo(index: number): void {
		if (!this.active) return;
		const target = Math.min(this.total - 1, Math.max(0, index));
		if (target !== this.index) this.#cut(target);
	}

	next(): void {
		this.goTo(this.index + 1);
	}

	previous(): void {
		this.goTo(this.index - 1);
	}

	/**
	 * Advance the scene clock. Returns true when the scene has run its length and the film should
	 * move on — the caller decides what that means, because on the LAST scene it means stopping,
	 * and a store that paused the playback itself would be reaching into something it doesn't own.
	 */
	advance(seconds: number): boolean {
		if (!this.active || !this.entry) return false;
		this.elapsed += seconds;
		return this.elapsed >= SCENE_SECONDS;
	}

	/** Build the scene: a fresh generation of that world's evolved brains, and a clean clock. */
	#cut(index: number): void {
		this.index = index;
		this.elapsed = 0;
		const source = this.#sources[index];
		this.entry = source ? makeEntry(STORY_WORLD_ID, makeStoryWorld(source.world)) : null;
	}
}

/** The story world's id. It is not on the bench, but the inspector still has to be able to find it. */
export const STORY_WORLD_ID = 'story';

/** The senses, in the order the bench introduces them — which is the order the story tells them. */
const SENSE_ORDER: { key: keyof Senses; name: string }[] = [
	{ key: 'dist', name: 'Distance' },
	{ key: 'dir', name: 'Direction' },
	{ key: 'closing', name: 'Closing speed' },
	{ key: 'walls', name: 'Walls' }
];

export const story = new StoryStore();
