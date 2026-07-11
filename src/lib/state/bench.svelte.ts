/**
 * Bench state — the ONLY seam through which the UI touches the simulation.
 *
 * Per README §7, components never mutate engine internals directly: they call engine functions
 * (`applyCfg`, `resetWorld`, toggle `cfg.senses.*` then `applyCfg`) through this store and read
 * state back for rendering.
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
	resetWorld as engineReset,
	applyCfg as engineApplyCfg,
	bestAliveFish,
	cloneGenome,
	ACCENTS
} from '../engine';
import type { World, WorldConfig, Senses } from '../engine';
import { createSimLoop, subSteps, turboSlice, type SimLoop } from '../sim/loop';

export type Speed = 0.5 | 1 | 2;

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
}

export interface WorldEntry {
	id: string;
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

class BenchStore {
	/** `$state.raw`: reassigned on add/remove, never deep-proxied. */
	worlds = $state.raw<WorldEntry[]>([]);
	running = $state(true);
	speed = $state<Speed>(1);
	/** Non-null while fast-forwarding generations; the loop trains instead of simulating. */
	turboTarget = $state<number | null>(null);
	/** Highest generation reached across the bench (the top-bar readout). */
	generationsEvolved = $state(0);
	maxGenerations = $state(0);

	#loop: SimLoop | null = null;
	#nextId = 0;
	/** Canvases register their paint fn here; the loop calls them directly — no reactivity. */
	#painters = new Set<() => void>();

	init({ configs, prewarmGenerations = 0, maxGenerations = 0 }: BenchInit): void {
		this.maxGenerations = maxGenerations;
		this.worlds = configs.map((cfg) => this.#entry(structuredClone(cfg)));
		if (prewarmGenerations > 0) this.turboTarget = prewarmGenerations;

		this.#loop ??= createSimLoop({ onFrame: (elapsed) => this.#frame(elapsed) });
		this.#loop.start();
	}

	destroy(): void {
		this.#loop?.stop();
		this.#loop = null;
		this.#painters.clear();
		this.worlds = [];
	}

	/** A canvas registers its painter; returns the unregister fn. */
	registerPainter(paint: () => void): () => void {
		this.#painters.add(paint);
		return () => this.#painters.delete(paint);
	}

	// ---- controls ----

	togglePlay(): void {
		this.running = !this.running;
	}

	setSpeed(speed: Speed): void {
		this.speed = speed;
	}

	/** Fast-forward every world to `gen` (used by prewarm and the "Train N gens" button). */
	trainTo(gen: number): void {
		if (this.turboTarget !== null) return; // already training
		if (gen > this.generationsEvolved) this.turboTarget = gen;
	}

	// ---- world CRUD (all mutation goes through engine functions) ----

	addWorld(cfg: WorldConfig): void {
		this.worlds = [...this.worlds, this.#entry(structuredClone(cfg))];
	}

	duplicateWorld(id: string): void {
		const src = this.find(id);
		if (!src) return;
		const cfg = structuredClone(src.world.cfg);
		cfg.name += ' copy';
		// carry the evolved brains across so the copy starts where the original is
		const genomes = src.world.roster.map((f) => cloneGenome(f.genome));
		const world = makeWorld(cfg, genomes);
		world.gen = src.world.gen;
		world.curve = src.world.curve.slice();
		world.champion = src.world.champion
			? {
					genome: cloneGenome(src.world.champion.genome),
					fitness: src.world.champion.fitness,
					gen: src.world.champion.gen
				}
			: null;

		const entry: WorldEntry = { id: this.#id(), world, stats: new WorldStats() };
		const i = this.worlds.findIndex((e) => e.id === id);
		this.worlds = [...this.worlds.slice(0, i + 1), entry, ...this.worlds.slice(i + 1)];
	}

	removeWorld(id: string): void {
		this.worlds = this.worlds.filter((e) => e.id !== id);
	}

	/** Restart evolution from random brains. */
	resetWorld(id: string): void {
		const e = this.find(id);
		if (e) engineReset(e.world);
	}

	/** Apply live config edits without wiping learning. */
	applyConfig(id: string): void {
		const e = this.find(id);
		if (e) engineApplyCfg(e.world);
	}

	/** Toggle one sense — a true live ablation (the input neuron then receives 0). */
	toggleSense(id: string, sense: keyof Senses): void {
		const e = this.find(id);
		if (!e) return;
		e.world.cfg.senses[sense] = !e.world.cfg.senses[sense];
		engineApplyCfg(e.world);
	}

	find(id: string): WorldEntry | undefined {
		return this.worlds.find((e) => e.id === id);
	}

	/** Next accent in the palette, so a new world gets a distinct colour. */
	nextAccent(): string {
		return ACCENTS[this.worlds.length % ACCENTS.length];
	}

	// ---- internals ----

	#id(): string {
		return `w${++this.#nextId}`;
	}

	#entry(cfg: WorldConfig): WorldEntry {
		return { id: this.#id(), world: makeWorld(cfg), stats: new WorldStats() };
	}

	#frame(elapsed: number): void {
		const worlds = this.worlds;
		for (const e of worlds) e.world.maxGen = this.maxGenerations;

		if (this.turboTarget !== null) {
			const done = turboSlice(
				worlds.map((e) => e.world),
				this.turboTarget
			);
			if (done) this.turboTarget = null;
		} else if (this.running) {
			const { steps, dt } = subSteps(elapsed, this.speed);
			for (const e of worlds) {
				for (let i = 0; i < steps; i++) stepWorld(e.world, dt);
			}
		}

		for (const e of worlds) e.world.championFish = bestAliveFish(e.world);

		this.#refreshStats(worlds);
		for (const paint of this.#painters) paint();
	}

	/** Copy the handful of primitives the UI binds to out of the raw worlds. */
	#refreshStats(worlds: readonly WorldEntry[]): void {
		let maxGen = 0;
		for (const { world: w, stats } of worlds) {
			stats.alive = w.fish.length;
			stats.eaten = w.eaten;
			stats.gen = w.gen;
			const surv = w.curve.length
				? w.curve[w.curve.length - 1]
				: w.fish.length / Math.max(1, w.cfg.prey);
			stats.survivalPct = Math.round(surv * 100);
			stats.championFitness = w.champion?.fitness ?? 0;
			stats.deployed = w._deployed;
			stats.deployT = w.deployT;
			stats.halfLife = w.halfLife;
			stats.extinctT = w.extinctT;
			if (w.gen > maxGen) maxGen = w.gen;
		}
		this.generationsEvolved = maxGen;
	}
}

export const bench = new BenchStore();
