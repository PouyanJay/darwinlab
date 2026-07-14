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
 * proxied), the canvas paints straight from the raw objects, and the UI binds instead to two
 * small reactive projections of each world:
 *
 *   WorldStats       what the world is DOING — alive, eaten, gen, survival. Refreshed each frame.
 *   WorldConfigView  what the world IS — name, senses, tank, accent. Refreshed when the store
 *                    writes to `cfg`, which is the only way `cfg` ever changes.
 *   MindView         what the SELECTED FISH is thinking — its senses and motor outputs, refreshed
 *                    each frame. One of these, because there is one inspector.
 *
 * All three are projections; `world` remains the single source of truth for every one of them.
 */

import {
	makeWorld,
	stepWorld,
	resetWorld as engineResetWorld,
	applyCfg as engineApplyCfg,
	updateSenseSnapshot,
	bestAliveFish,
	cloneGenome,
	ACCENTS,
	WORLD_LIMITS,
	PERSISTENCE_DEFAULTS,
	MAX_GENERATIONS
} from '../engine';
import { seededRng } from '../engine';
import type { World, WorldConfig, Senses, Fish, Predator, NumericCondition } from '../engine';
import { configHash, manifest } from '../lab/run';
import type { Rng } from '../engine';
import type { Picked, Lens } from '../render';
import { subSteps, turboSlice } from '../sim/loop';
import { DetailGovernor } from '../sim/governor';
import { Playback, type Speed } from './playback.svelte';
import { PainterRegistry } from './painters';
import { WorldStats, WorldConfigView, MindView, makeEntry, type WorldEntry } from './views.svelte';
import { story } from './story.svelte';
import { evals } from './evals.svelte';

export { WorldStats, WorldConfigView, MindView, type WorldEntry };

export type { Speed };

/**
 * What the Brain Inspector is looking at. One selection across the whole bench: clicking into a
 * second world drops the first, because there is one inspector.
 */
export interface Selection {
	readonly worldId: string;
	readonly type: 'fish' | 'pred';
	/**
	 * True when the user asked for "the best brain alive" (the ★ Champion button) rather than one
	 * particular fish. That distinction is what a generation turnover hangs on: a champion selection
	 * re-resolves to the new generation's best fish — that lineage is exactly what the product is
	 * about — while a hand-picked fish is simply gone, and the inspector closes rather than quietly
	 * swapping in a different creature and letting you believe it is still yours.
	 */
	readonly followsChampion: boolean;
}

export interface BenchInit {
	configs: WorldConfig[];
	/**
	 * The random source every world draws from. Left out, each world gets `Math.random`, which is
	 * what the app wants; a test that cares WHEN a population dies passes a seeded one and gets the
	 * same run every time.
	 */
	rng?: Rng;
	/** Evolve this many generations before the first paint so the bench opens competent. */
	prewarmGenerations?: number;
	/** Once a world reaches this generation it deploys (stops evolving). 0 = never. */
	maxGenerations?: number;
	/** The seed this run is launched on. Null (the default) = unseeded, and NOT reproducible. */
	seed?: number | null;
}

/** Hold a value inside the range the lab offers. The engine does not validate; the store must. */
function clamp(value: number, { min, max }: { min: number; max: number }): number {
	return Math.min(max, Math.max(min, value));
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
	/** What the inspector is showing — one across the bench. `$state.raw`: replaced, never mutated. */
	selection = $state.raw<Selection | null>(null);
	/** The world whose Conditions dialog is open, or null. One dialog, like one inspector. */
	conditionsWorldId = $state<string | null>(null);
	/** What the selected fish is thinking, refreshed every frame while a fish is selected. */
	readonly mind = new MindView();

	readonly playback = new Playback();
	readonly painters = new PainterRegistry();

	/**
	 * $state, not a plain field: the tile's "· trained" suffix and the top bar's Train label are
	 * derived from it, and a getter over a non-reactive field never wakes a reader. Invisible while
	 * it is always 0 — and quietly broken the moment Phase 7 starts driving it.
	 */
	#maxGenerations = $state(0);
	/**
	 * The story stage's render detail — 'cinematic' until this machine proves it can't afford it.
	 * `$state` because the stage binds to it and must re-render the frame the governor flips it.
	 */
	#detail = $state<'cinematic' | 'performance'>('cinematic');
	/**
	 * What every tank is coloured BY — one lens across the whole bench, deliberately.
	 *
	 * The lens exists to make a COMPARISON legible ("blind is confetti, bearing is calm"), and a
	 * comparison you have to switch on five times, card by card, is a comparison nobody makes. It is
	 * a way of looking and nothing else: no lens writes a weight, a fitness, a curve or an RNG draw.
	 */
	#lens = $state<Lens>('none');
	/** One repaint owed outside the sim advancing — set by every method that changes pixels. */
	#needsPaint = false;
	/**
	 * True when the current selection was made by the tank's keyboard cycler. The inspector reads
	 * this to leave the walker's focus alone — a walk is not a click, and stealing focus on the
	 * first arrow-press would end it one creature in. `$state` because the drawer binds to it.
	 */
	#walkSelection = $state(false);
	#governor = new DetailGovernor();
	#nextId = 0;
	#accentCursor = 0;
	/** Cached raw worlds for the turbo path, so training allocates nothing per frame. */
	#rawWorlds: World[] = [];
	/** Undefined = each world uses the engine's default (Math.random). Tests pass a seeded one. */
	#rng: Rng | undefined;
	/**
	 * The seed this run was launched with, or null when it is unseeded.
	 *
	 * `$state` because the run manifest in the top bar reads it. NULL IS THE HONEST DEFAULT: the
	 * app opens on Math.random, so the opening run is genuinely NOT reproducible, and a manifest
	 * that printed a seed anyway would be lying about what it can hand you.
	 */
	#seed = $state<number | null>(null);
	/** What each environment was CREATED as — the baseline its "overrides" chip is measured against. */
	#baselines = new Map<string, WorldConfig>();

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
	get lens(): Lens {
		return this.#lens;
	}
	/** Is a fast-forward burst under way? Playback already knows; every caller asking
	 *  `turboTarget !== null` for itself is the same question spelled a second way. */
	get training(): boolean {
		return this.playback.training;
	}
	get maxGenerations(): number {
		return this.#maxGenerations;
	}
	get detail(): 'cinematic' | 'performance' {
		return this.#detail;
	}
	get walkSelection(): boolean {
		return this.#walkSelection;
	}

	/** The seed this run was launched with — null when unseeded, and therefore unreproducible. */
	get seed(): number | null {
		return this.#seed;
	}

	/** Fingerprint of the CURRENT configuration of every environment on the bench. */
	get configHash(): string {
		return configHash(this.worlds.map((entry) => entry.world.cfg));
	}

	/** The full run manifest — what "copy config" hands to someone who wants your numbers. */
	get manifest(): Record<string, unknown> {
		return manifest(
			this.worlds.map((entry) => entry.world.cfg),
			this.#seed,
			this.#maxGenerations
		);
	}

	/** What this environment was created as. The tile diffs its REACTIVE view against this. */
	baselineOf(id: string): WorldConfig | undefined {
		return this.#baselines.get(id);
	}

	init({ configs, prewarmGenerations = 0, maxGenerations = 0, rng, seed = null }: BenchInit): void {
		this.setMaxGenerations(maxGenerations); // the same door every other caller uses, clamp and all
		this.#seed = seed;
		this.#rng = rng ?? (seed === null ? undefined : seededRng(seed));
		this.#baselines.clear();
		this.#setWorlds(configs.map((cfg) => this.#create(structuredClone(cfg))));
		if (prewarmGenerations > 0) this.playback.requestTraining(prewarmGenerations);
		this.playback.start((elapsed, frameSeconds) => this.tick(elapsed, frameSeconds));
	}

	/** Tear down completely — every field returns to its construction default, no state survives. */
	destroy(): void {
		story.exit(); // the film is composed from bench worlds — it cannot outlive them
		this.playback.reset();
		this.painters.clear();
		this.worlds = [];
		this.#rawWorlds = [];
		this.generationsEvolved = 0;
		this.selection = null;
		this.conditionsWorldId = null;
		this.#rng = undefined;
		this.#maxGenerations = 0;
		this.#detail = 'cinematic';
		this.#needsPaint = false;
		this.#walkSelection = false;
		this.#governor = new DetailGovernor();
		this.#nextId = 0;
		this.#accentCursor = 0;
	}

	// ---- controls (delegated) ----

	togglePlay(): void {
		this.playback.toggle();
	}

	/** Change what the tanks are coloured by. A paused bench still owes the new colours a repaint. */
	setLens(lens: Lens): void {
		this.#lens = lens;
		this.requestPaint();
	}

	setSpeed(speed: Speed): void {
		this.playback.setSpeed(speed);
	}

	/** Fast-forward every world to `gen` (used by prewarm and the "Train N gens" button). */
	trainTo(gen: number): void {
		if (gen > this.generationsEvolved) this.playback.requestTraining(gen);
	}

	/**
	 * How many generations a world trains for before it deploys. 0 = never.
	 *
	 * Lowering it below where a world already is deploys that world on the spot; raising it puts the
	 * world back to evolving, which is the honest thing to do — the run is over, and what is left of
	 * the population breeds on. Reaching a limit is not a one-way door, it is just a limit.
	 */
	setMaxGenerations(gen: number): void {
		this.#maxGenerations = clamp(Math.round(gen), MAX_GENERATIONS);
		for (const world of this.#rawWorlds) world.maxGen = this.#maxGenerations;
		this.requestPaint(); // lowering it can deploy a world on the spot
	}

	// ---- world CRUD (all sim mutation funnels through engine fns) ----

	addWorld(cfg: WorldConfig): void {
		this.#setWorlds([...this.worlds, this.#create(structuredClone(cfg))]);
	}

	duplicateWorld(id: string): void {
		const index = this.worlds.findIndex((entry) => entry.id === id);
		const source = assertEntry(this.worlds[index], id);

		const cfg = structuredClone(source.world.cfg);
		cfg.name = this.#uniqueName(`${cfg.name} copy`);
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
		// Anything pointing INTO the world that just went away has to go with it, now — not on the
		// next frame, or a component could render one frame against a world the bench no longer has.
		if (this.selection?.worldId === id) this.selection = null;
		if (this.conditionsWorldId === id) this.conditionsWorldId = null;
	}

	/** Restart evolution from random brains. */
	resetWorld(id: string): void {
		// the result described a population that no longer exists — keeping it would be a lie
		evals.forget(id);
		engineResetWorld(this.entry(id).world);
		this.requestPaint();
	}

	/**
	 * Rename a world. A name is a label, not a condition — nothing about the simulation changes, so
	 * this deliberately does NOT go through applyCfg.
	 */
	renameWorld(id: string, name: string): void {
		this.entry(id).world.cfg.name = name;
		this.#publishConfig(id);
	}

	/** Apply live config edits without wiping learning. */
	applyConfig(id: string): void {
		engineApplyCfg(this.entry(id).world);
		this.#publishConfig(id);
	}

	/**
	 * Change one condition of the experiment, live.
	 *
	 * This is the whole point of the Conditions dialog and it is worth being precise about: the world
	 * KEEPS EVOLVING. Its generation, its learning curve and its champion all survive. Widening the
	 * tank re-clamps the fish into it; adding prey seeds the newcomers from the champion's genome
	 * rather than dropping in random brains; removing prey takes them out of the roster too. That is
	 * `applyCfg`'s job, and it is why every edit here ends in it.
	 *
	 * The value is clamped to WORLD_LIMITS on the way in — the engine does not validate, and a
	 * container 40px wide or a population of -3 is not an experiment, it is a crash.
	 */
	setCondition(id: string, key: NumericCondition, value: number): void {
		const { world } = this.entry(id);
		world.cfg[key] = clamp(value, WORLD_LIMITS[key]);
		engineApplyCfg(world);
		this.#publishConfig(id);
	}

	/**
	 * The shark's hunger ramp: on, it gets faster and wider-jawed the longer it goes without a
	 * kill, so no stalemate lasts forever and nothing stays safe. Off — the bench's default — it
	 * is the same hunter all run long, and a population that genuinely learned is allowed to LOOK
	 * safe, which is the only way evolved evasion ever reads on screen.
	 *
	 * Switching it on hands the world the reference engine's own ramp figures unless it already
	 * carries its own, so the three sliders beneath the toggle open on something real rather than
	 * on zeroes.
	 */
	setPersistence(id: string, on: boolean): void {
		const { world } = this.entry(id);
		world.cfg.persistence = on;
		if (on) {
			world.cfg.persistRamp ??= PERSISTENCE_DEFAULTS.persistRamp;
			world.cfg.persistMaxBoost ??= PERSISTENCE_DEFAULTS.persistMaxBoost;
			world.cfg.persistMaxJaw ??= PERSISTENCE_DEFAULTS.persistMaxJaw;
		}
		engineApplyCfg(world);
		this.#publishConfig(id);
	}

	/** The world's colour. A label, like the name — nothing about the simulation changes. */
	setAccent(id: string, accent: string): void {
		this.entry(id).world.cfg.accent = accent;
		this.#publishConfig(id);
	}

	/** The line of narration story mode reads out when this world is on screen. Also just a label. */
	setCaption(id: string, caption: string): void {
		this.entry(id).world.cfg.caption = caption;
		this.#publishConfig(id);
	}

	/** Toggle one sense — a true live ablation (the input neuron then receives 0). */
	toggleSense(id: string, sense: keyof Senses): void {
		this.setSense(id, sense, !this.entry(id).world.cfg.senses[sense]);
	}

	/** Wire a sense in or cut it. Cutting it feeds that input neuron 0 for every brain in the world. */
	setSense(id: string, sense: keyof Senses, on: boolean): void {
		const { world } = this.entry(id);
		world.cfg.senses[sense] = on;
		engineApplyCfg(world);
		this.#publishConfig(id);
	}

	// ---- the conditions dialog ----

	openConditions(id: string): void {
		this.conditionsWorldId = this.entry(id).id;
	}

	closeConditions(): void {
		this.conditionsWorldId = null;
	}

	/**
	 * Highlight a creature under the pointer. Components must not touch `world.hover` directly.
	 *
	 * Unlike every other method here this one does NOT assert the world exists: a pointer event can
	 * land just after its tile was removed, and hover is best-effort state about a cursor, not a
	 * claim about the bench. Throwing out of a mousemove listener would be the wrong answer.
	 */
	setHover(id: string, target: Fish | Predator | null): void {
		const entry = this.find(id);
		if (!entry || entry.world.hover === target) return; // mousemove fires at pointer rate —
		entry.world.hover = target; // an unchanged hover must not wake a paused bench's canvases
		this.requestPaint();
	}

	// ---- selection (one inspector, so one selection across the bench) ----

	/** Select what the pointer landed on — a fish, the shark, or (on empty water) nothing. */
	select(id: string, picked: Picked | null): void {
		this.#walkSelection = false; // a pick is a pointer act unless cycleSelection says otherwise
		this.#deselectEverywhere();
		if (!picked) {
			this.selection = null;
			return;
		}
		if (picked.type === 'pred') {
			this.selection = { worldId: id, type: 'pred', followsChampion: false };
			return;
		}
		this.#watch(id, picked.obj, false);
	}

	/** "★ Champion" — watch the best brain currently alive, and keep watching it as it evolves. */
	selectChampion(id: string): void {
		const best = bestAliveFish(this.entry(id).world);
		if (!best) return; // nothing alive to watch — leave the current selection alone
		this.#walkSelection = false;
		this.#deselectEverywhere();
		this.#watch(id, best, true);
	}

	clearSelection(): void {
		this.#deselectEverywhere();
		this.selection = null;
	}

	/**
	 * Move the selection to the next or previous creature in a world — the keyboard's click.
	 *
	 * The walk is the fish as the engine lists them, then ONE stop for the predator: sharks are
	 * identical rule-machines and the store records a predator selection without saying which,
	 * so as a selection they are a single creature however many are hunting. From nothing the
	 * walk enters at whichever end the direction points at, and it wraps. A cycled-to fish is
	 * HAND-PICKED (`followsChampion: false`): the user pointed at a particular creature, they
	 * just did it with keys.
	 */
	cycleSelection(id: string, direction: 1 | -1): void {
		const { world } = this.entry(id);
		const stops: (Fish | Predator)[] = world.preds.length
			? [...world.fish, world.preds[0]]
			: [...world.fish];
		if (stops.length === 0) return;

		// Entering from nothing: one step forward lands on the first stop, one step back on the
		// last — as if the selection had been standing just outside the matching end.
		const current = this.#selectedStop(id, world, stops);
		const start = current ?? (direction === 1 ? -1 : stops.length);
		const target = stops[(start + direction + stops.length) % stops.length];

		const picked: Picked =
			'genome' in target ? { type: 'fish', obj: target } : { type: 'pred', obj: target };
		this.select(id, picked);
		this.#walkSelection = true; // after select(), which marks every pick a pointer act first
	}

	/** Where the current selection sits on this world's walk, or null for "not here". */
	#selectedStop(id: string, world: World, stops: (Fish | Predator)[]): number | null {
		if (this.selection?.worldId !== id) return null;
		if (this.selection.type === 'fish' && world.selFish) {
			const index = stops.indexOf(world.selFish);
			return index === -1 ? null : index;
		}
		// The single predator stop — which only exists while predators do. A pred selection can
		// outlive its predators (Conditions can set them to 0), and treating it as a stop then
		// would start the walk one past the end and skip the first fish.
		if (this.selection.type === 'pred') return world.preds.length ? world.fish.length : null;
		return null;
	}

	/**
	 * Roll the film. The bench stops where it is and waits.
	 *
	 * Not while it is TRAINING, though: a story does not advance the bench, so a turbo burst caught
	 * mid-flight would simply hang there — the pill spinning behind the film, the worlds frozen part
	 * way to their target. Let the training land first.
	 */
	playStory(): boolean {
		// story.start() refuses an empty bench, so ask IT first: clearing the selection before knowing
		// whether the film can roll would drop the inspector for nothing.
		if (this.playback.training || !story.start(this.worlds)) return false;
		this.clearSelection();
		this.playback.play();
		return true;
	}

	/** Back to the bench, exactly as it was left. */
	exitStory(): void {
		this.clearSelection();
		story.exit();
		this.playback.play();
		this.requestPaint(); // the bench slept through the film — wake its canvases
	}

	/** Look up a world, throwing on an unknown id (a miss is always a caller bug). */
	entry(id: string): WorldEntry {
		return assertEntry(this.find(id), id);
	}

	/**
	 * Look up a world. Includes the STORY world, which is not on the bench but is very much on
	 * screen — you can click a fish mid-film and read its brain, and the inspector has no idea it is
	 * looking at a scene.
	 */
	find(id: string): WorldEntry | undefined {
		if (story.entry?.id === id) return story.entry;
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
	 * Relaunch the whole bench on a seed — the control that makes a run REPRODUCIBLE.
	 *
	 * Everything goes: the worlds, their evolved brains, the curves, the selection. That is the
	 * point — a seeded run is a fresh experiment, not the old one relabelled, and pretending
	 * otherwise would hand someone a manifest that does not reproduce what they are looking at.
	 * Pass null to go back to an unseeded run.
	 */
	reseed(seed: number | null, configs: WorldConfig[], prewarmGenerations = 0): void {
		const maxGenerations = this.#maxGenerations;
		this.playback.reset();
		this.painters.clear();
		this.selection = null;
		this.conditionsWorldId = null;
		this.#nextId = 0;
		this.init({ configs, prewarmGenerations, maxGenerations, seed });
	}

	/**
	 * Advance the bench by one frame. The loop drives this; it is public so tests can step the
	 * store deterministically instead of racing a 16ms timer.
	 */
	tick(elapsed: number, frameSeconds: number = elapsed): void {
		// The governor judges RENDERING, so it must not see training frames: turbo deliberately
		// burns a 15ms slice per frame, which reads as ~31ms — past the downgrade line — and the
		// load-time prewarm alone would ratchet every machine to 'performance' before the first
		// story ever played.
		if (!this.playback.training && this.#governor.sample(frameSeconds)) {
			this.#detail = 'performance';
		}

		if (story.active) this.#tickStory(elapsed);
		else this.#tickBench(elapsed);

		this.#reconcileSelection();
		this.#publishMind();
		this.#paint();
	}

	/**
	 * Ask for one repaint even though the sim is not advancing. Every store method that changes
	 * what the pixels are built from calls this, so a PAUSED bench still shows a hover ring or a
	 * widened tank the frame after the interaction — and shows nothing at all the rest of the time.
	 */
	requestPaint(): void {
		this.#needsPaint = true;
	}

	/**
	 * Repaint only when there is something new to show: the sim advanced, or an interaction
	 * changed the picture. A paused bench repainting sixteen canvases at 60fps was Phase 9's
	 * biggest measured waste — worse, it kept doing it behind a playing film.
	 */
	#paint(): void {
		const advanced = this.playback.running || this.playback.training;
		if (!advanced && !this.#needsPaint) return;
		this.#needsPaint = false;
		this.painters.paintAll(story.active ? 'story' : 'bench');
	}

	/**
	 * A story is playing, so the BENCH does not move.
	 *
	 * There is one thing on screen and it is the scene; stepping twenty-five other fish behind a
	 * full-screen takeover would burn the frame budget the film needs and, worse, let the bench
	 * evolve past the state the scene was cut from.
	 */
	#tickStory(elapsed: number): void {
		const entry = story.entry;
		if (!entry) return;

		if (this.playback.running) {
			const { steps, dt } = subSteps(elapsed, this.playback.speed);
			for (let i = 0; i < steps; i++) stepWorld(entry.world, dt);
			this.#advanceScene(elapsed);
		}

		entry.world.championFish = bestAliveFish(entry.world);
		entry.stats.syncFrom(entry.world);
	}

	/**
	 * Run the scene's clock and hand over when it is spent.
	 *
	 * The clock runs on SIM time, so ½× and 2× slow down and speed up the film itself: a scene lasts
	 * as long as it takes the fish to live 18 seconds, not 18 of ours. The last scene does not hand
	 * over — it stops, holding its final image.
	 */
	#advanceScene(elapsed: number): void {
		if (!story.advance(elapsed * this.playback.speed)) return;
		if (story.isLastScene) this.playback.pause();
		else story.next();
	}

	#tickBench(elapsed: number): void {
		const worlds = this.#rawWorlds;

		if (this.playback.training) {
			if (turboSlice(worlds, this.playback.turboTarget!)) {
				this.playback.finishTraining();
				this.requestPaint(); // the flag is already down when #paint runs — still show the result
			}
		} else if (this.playback.running) {
			const { steps, dt } = subSteps(elapsed, this.playback.speed);
			for (const world of worlds) {
				for (let i = 0; i < steps; i++) stepWorld(world, dt);
			}
		}

		let highest = 0;
		const lensOn = this.#lens === 'flee';
		for (const entry of this.worlds) {
			entry.world.championFish = bestAliveFish(entry.world);
			entry.stats.syncFrom(entry.world);
			entry.stats.syncLens(entry.world, lensOn);
			if (entry.world.gen > highest) highest = entry.world.gen;
		}
		this.generationsEvolved = highest;
	}

	// ---- internals ----

	/** Point a world at the fish to inspect, and fill in its mind now (it may be paused). */
	#watch(id: string, fish: Fish, followsChampion: boolean): void {
		const { world } = this.entry(id);
		world.selFish = fish;
		updateSenseSnapshot(world);
		this.selection = { worldId: id, type: 'fish', followsChampion };
		this.#syncMind(world); // the panel opens populated, even when the sim is paused
	}

	/**
	 * There is one inspector, so at most one world may hold a selected fish — the scene included.
	 * Every selection change passes through here, so this is also where the repaint is owed: a
	 * ring appearing or vanishing must reach a paused canvas too.
	 */
	#deselectEverywhere(): void {
		this.requestPaint();
		const worlds = story.entry ? [...this.#rawWorlds, story.entry.world] : this.#rawWorlds;
		for (const world of worlds) {
			world.selFish = null;
			world.sense = null;
		}
	}

	/**
	 * Keep the selection honest once the world has moved on.
	 *
	 * The engine drops `selFish` the moment that fish stops existing — eaten, or replaced when its
	 * generation ended. So a null pointer here means the creature the user was watching is gone, and
	 * we either follow the champion lineage into the new generation or admit the selection is over.
	 * Nothing is ever left pointing at a fish that isn't swimming.
	 */
	#reconcileSelection(): void {
		const selection = this.selection;
		if (!selection) return;

		const entry = this.find(selection.worldId);
		if (!entry) {
			this.selection = null; // its world was removed out from under it
			return;
		}
		if (selection.type === 'pred') {
			// Conditions can remove every predator live — the inspector must not keep presenting
			// a shark that is no longer in the water.
			if (entry.world.preds.length === 0) this.selection = null;
			return;
		}
		if (entry.world.selFish) return; // still swimming

		const heir = selection.followsChampion ? bestAliveFish(entry.world) : null;
		if (heir) this.#watch(selection.worldId, heir, true);
		else this.selection = null;
	}

	/** Republish the selected fish's mind. The engine filled it in during the step; we only read. */
	#publishMind(): void {
		const selection = this.selection;
		if (!selection || selection.type !== 'fish') return;
		const world = this.find(selection.worldId)?.world;
		if (world) this.#syncMind(world);
	}

	#syncMind(world: World): void {
		if (world.sense) this.mind.syncFrom(world.sense);
	}

	#id(): string {
		return `w${++this.#nextId}`;
	}

	/** A name no live world is using — two tiles reading "Direction copy" are simply ambiguous. */
	#uniqueName(wanted: string): string {
		const taken = new Set(this.worlds.map((entry) => entry.world.cfg.name));
		if (!taken.has(wanted)) return wanted;
		let n = 2;
		while (taken.has(`${wanted} ${n}`)) n++;
		return `${wanted} ${n}`;
	}

	#wrap(world: World): WorldEntry {
		world.maxGen = this.#maxGenerations;
		const entry = makeEntry(this.#id(), world);
		// what it was created as — every override chip is measured against this
		this.#baselines.set(entry.id, structuredClone(world.cfg));
		return entry;
	}

	/** Re-project a world's cfg after the store has written to it. Every cfg write ends here. */
	#publishConfig(id: string): void {
		const entry = this.entry(id);
		entry.config.syncFrom(entry.world.cfg);
		this.requestPaint(); // a condition edit must be visible while paused, too
	}

	#create(cfg: WorldConfig): WorldEntry {
		return this.#wrap(makeWorld(cfg, undefined, this.#rng));
	}

	/** Single place the world list changes, so the raw-world cache can never drift out of sync. */
	#setWorlds(entries: WorldEntry[]): void {
		this.worlds = entries;
		this.#rawWorlds = entries.map((entry) => entry.world);
		this.requestPaint();
	}
}

export const bench = new BenchStore();
