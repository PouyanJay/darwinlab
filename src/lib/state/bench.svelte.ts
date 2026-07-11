/**
 * Bench state — the ONLY seam through which the UI touches the simulation.
 *
 * Per README §7, components never mutate engine internals directly: they go through this store,
 * which calls engine functions (`applyCfg`, `resetWorld`, sense toggles, hover). If you find
 * yourself writing `entry.world.<something> = ...` in a component, add a method here instead.
 *
 * Responsibilities are split: `Playback` owns *how time advances* (loop, play/pause, speed,
 * turbo) and `PainterRegistry` owns *who repaints*. This store owns *which worlds exist* and
 * bridges them together once per frame.
 *
 * PERFORMANCE — why worlds are NOT reactive:
 * A `World` is mutated ~60×/s and holds every fish, trail point and 68-weight genome. Wrapping
 * it in `$state` would deep-proxy all of that and fire reactivity on every mutation, which is
 * catastrophic at frame rate. So worlds live in `$state.raw` (reassigned on add/remove, never
 * proxied), the canvas paints straight from the raw objects, and the UI binds instead to a tiny
 * reactive `WorldStats` snapshot refreshed once per frame.
 */

import {
	makeWorld,
	stepWorld,
	resetWorld as engineResetWorld,
	applyCfg as engineApplyCfg,
	bestAliveFish,
	cloneGenome,
	ACCENTS
} from '../engine';
import type { World, WorldConfig, Senses, Fish, Predator } from '../engine';
import { subSteps, turboSlice } from '../sim/loop';
import { Playback, type Speed } from './playback.svelte';
import { PainterRegistry } from './painters';

export type { Speed };

/** Cheap reactive snapshot of one world, refreshed once per frame for the UI to bind to. */
export class WorldStats {
	alive = $state(0);
	eaten = $state(0);
	gen = $state(0);
	/** Smoothed survival rate of the latest generation, 0–100. */
	survivalPct = $state(0);
	championFitness = $state(0);
	deployed = $state(false);
	deployT = $state(0);
	halfLife = $state<number | null>(null);
	extinctT = $state<number | null>(null);

	/** Project the raw world onto this snapshot. The projection lives with the data it produces. */
	syncFrom(world: World): void {
		this.alive = world.fish.length;
		this.eaten = world.eaten;
		this.gen = world.gen;
		const survival = world.curve.length
			? world.curve[world.curve.length - 1]
			: world.fish.length / Math.max(1, world.cfg.prey);
		this.survivalPct = Math.round(survival * 100);
		this.championFitness = world.champion?.fitness ?? 0;
		this.deployed = world._deployed;
		this.deployT = world.deployT;
		this.halfLife = world.halfLife;
		this.extinctT = world.extinctT;
	}
}

export interface WorldEntry {
	readonly id: string;
	/** The raw engine world — deliberately NOT reactive (see file header). */
	readonly world: World;
	readonly stats: WorldStats;
}

export interface BenchInit {
	configs: WorldConfig[];
	/** Evolve this many generations before the first paint so the bench opens competent. */
	prewarmGenerations?: number;
	/** Once a world reaches this generation it deploys (stops evolving). 0 = never. */
	maxGenerations?: number;
}

/** Thrown when a caller passes an id the bench doesn't know — always a caller bug, never data. */
function assertEntry(entry: WorldEntry | undefined, id: string): WorldEntry {
	if (!entry) throw new Error(`bench: no world with id "${id}"`);
	return entry;
}

class BenchStore {
	/** `$state.raw`: reassigned on add/remove, never deep-proxied. */
	worlds = $state.raw<WorldEntry[]>([]);
	/** Highest generation reached across the bench (the top-bar readout). */
	generationsEvolved = $state(0);

	readonly playback = new Playback();
	readonly painters = new PainterRegistry();

	#maxGenerations = 0;
	#nextId = 0;
	#accentCursor = 0;
	/** Cached raw worlds for the turbo path, so training allocates nothing per frame. */
	#rawWorlds: World[] = [];

	// read-only projections of playback, so the UI binds to one object
	get running(): boolean {
		return this.playback.running;
	}
	get speed(): Speed {
		return this.playback.speed;
	}
	get turboTarget(): number | null {
		return this.playback.turboTarget;
	}
	get maxGenerations(): number {
		return this.#maxGenerations;
	}

	init({ configs, prewarmGenerations = 0, maxGenerations = 0 }: BenchInit): void {
		this.#maxGenerations = maxGenerations;
		this.#setWorlds(configs.map((cfg) => this.#create(structuredClone(cfg))));
		if (prewarmGenerations > 0) this.playback.requestTraining(prewarmGenerations);
		this.playback.start((elapsed) => this.tick(elapsed));
	}

	/** Tear down completely — every field returns to its construction default, no state survives. */
	destroy(): void {
		this.playback.reset();
		this.painters.clear();
		this.worlds = [];
		this.#rawWorlds = [];
		this.generationsEvolved = 0;
		this.#maxGenerations = 0;
		this.#nextId = 0;
		this.#accentCursor = 0;
	}

	// ---- controls (delegated) ----

	togglePlay(): void {
		this.playback.toggle();
	}

	setSpeed(speed: Speed): void {
		this.playback.setSpeed(speed);
	}

	/** Fast-forward every world to `gen` (used by prewarm and the "Train N gens" button). */
	trainTo(gen: number): void {
		if (gen > this.generationsEvolved) this.playback.requestTraining(gen);
	}

	setMaxGenerations(gen: number): void {
		this.#maxGenerations = gen;
		for (const world of this.#rawWorlds) world.maxGen = gen;
	}

	// ---- world CRUD (all sim mutation funnels through engine fns) ----

	addWorld(cfg: WorldConfig): void {
		this.#setWorlds([...this.worlds, this.#create(structuredClone(cfg))]);
	}

	duplicateWorld(id: string): void {
		const index = this.worlds.findIndex((entry) => entry.id === id);
		const source = assertEntry(this.worlds[index], id);

		const cfg = structuredClone(source.world.cfg);
		cfg.name += ' copy';
		// carry the evolved brains across so the copy starts where the original is
		const genomes = source.world.roster.map((fish) => cloneGenome(fish.genome));
		const world = makeWorld(cfg, genomes);
		world.gen = source.world.gen;
		world.curve = source.world.curve.slice();
		world.champion = source.world.champion
			? {
					genome: cloneGenome(source.world.champion.genome),
					fitness: source.world.champion.fitness,
					gen: source.world.champion.gen
				}
			: null;

		const copy = this.#wrap(world);
		this.#setWorlds([...this.worlds.slice(0, index + 1), copy, ...this.worlds.slice(index + 1)]);
	}

	removeWorld(id: string): void {
		this.#setWorlds(this.worlds.filter((entry) => entry.id !== id));
	}

	/** Restart evolution from random brains. */
	resetWorld(id: string): void {
		engineResetWorld(this.entry(id).world);
	}

	/** Apply live config edits without wiping learning. */
	applyConfig(id: string): void {
		engineApplyCfg(this.entry(id).world);
	}

	/** Toggle one sense — a true live ablation (the input neuron then receives 0). */
	toggleSense(id: string, sense: keyof Senses): void {
		const { world } = this.entry(id);
		world.cfg.senses[sense] = !world.cfg.senses[sense];
		engineApplyCfg(world);
	}

	/** Highlight a creature under the pointer. Components must not touch `world.hover` directly. */
	setHover(id: string, target: Fish | Predator | null): void {
		this.entry(id).world.hover = target;
	}

	/** Look up a world, throwing on an unknown id (a miss is always a caller bug). */
	entry(id: string): WorldEntry {
		return assertEntry(this.find(id), id);
	}

	find(id: string): WorldEntry | undefined {
		return this.worlds.find((entry) => entry.id === id);
	}

	/** An accent no live world is using, so a new world always reads as distinct. */
	nextAccent(): string {
		const inUse = new Set(this.worlds.map((entry) => entry.world.cfg.accent));
		return (
			ACCENTS.find((accent) => !inUse.has(accent)) ?? ACCENTS[this.#accentCursor++ % ACCENTS.length]
		);
	}

	/**
	 * Advance the bench by one frame. The loop drives this; it is public so tests can step the
	 * store deterministically instead of racing a 16ms timer.
	 */
	tick(elapsed: number): void {
		const worlds = this.#rawWorlds;

		if (this.playback.training) {
			if (turboSlice(worlds, this.playback.turboTarget!)) this.playback.finishTraining();
		} else if (this.playback.running) {
			const { steps, dt } = subSteps(elapsed, this.playback.speed);
			for (const world of worlds) {
				for (let i = 0; i < steps; i++) stepWorld(world, dt);
			}
		}

		let highest = 0;
		for (const entry of this.worlds) {
			entry.world.championFish = bestAliveFish(entry.world);
			entry.stats.syncFrom(entry.world);
			if (entry.world.gen > highest) highest = entry.world.gen;
		}
		this.generationsEvolved = highest;

		this.painters.paintAll();
	}

	// ---- internals ----

	#id(): string {
		return `w${++this.#nextId}`;
	}

	#wrap(world: World): WorldEntry {
		world.maxGen = this.#maxGenerations;
		return { id: this.#id(), world, stats: new WorldStats() };
	}

	#create(cfg: WorldConfig): WorldEntry {
		return this.#wrap(makeWorld(cfg));
	}

	/** Single place the world list changes, so the raw-world cache can never drift out of sync. */
	#setWorlds(entries: WorldEntry[]): void {
		this.worlds = entries;
		this.#rawWorlds = entries.map((entry) => entry.world);
	}
}

export const bench = new BenchStore();
