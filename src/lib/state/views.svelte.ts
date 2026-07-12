/**
 * The reactive PROJECTIONS of a world — what components are allowed to bind to.
 *
 * A `World` is raw and unreactive on purpose: it is mutated ~60×/s and holds every fish, trail
 * point and 68-weight genome, and deep-proxying that would fire reactivity at frame rate (see the
 * bench store's header). So the UI never reads `world.*` directly. It reads one of these instead:
 *
 *   WorldStats       what a world is DOING — alive, eaten, gen, survival, its deployment.
 *   WorldConfigView  what a world IS — name, senses, tank, accent.
 *   MindView         what the SELECTED FISH is thinking — its senses and motor outputs.
 *
 * They live here rather than in the bench store because story mode has a world too, and it needs
 * exactly the same projections — a scene is a world like any other, just a temporary one.
 *
 * Every one of them is projected FROM the engine and never computed independently of it. That is
 * what lets the UI claim to be showing the simulation rather than an illustration of it.
 */

import type { World, WorldConfig, Senses, SenseSnapshot } from '../engine';

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
		// The LIFE curve, not the alive-at-the-bell curve: fitness is seconds survived, so this is
		// the number selection is actually pushing on — and the only one that can still see a brain
		// improving in a tank where nearly every fish dies (see World.lifeCurve).
		const survival = world.lifeCurve.length
			? world.lifeCurve[world.lifeCurve.length - 1]
			: world.fish.length / Math.max(1, world.cfg.prey);
		this.survivalPct = Math.round(survival * 100);
		this.championFitness = world.champion?.fitness ?? 0;
		this.deployed = world._deployed;
		this.deployT = world.deployT;
		this.halfLife = world.halfLife;
		this.extinctT = world.extinctT;
	}
}

/**
 * What the selected fish is thinking, right now — the numbers the Brain Inspector reads.
 *
 * A projection of `world.sense`, which the ENGINE fills in each step (`updateSenseSnapshot`). The
 * UI never computes a sense itself: the bars, the brain canvas and the tank's perception overlay
 * are all reading the same numbers the fish's own network was fed, which is the only way the panel
 * can honestly claim to show what the fish senses rather than what we think it should.
 */
export class MindView {
	/** Seconds this fish has survived — its fitness, live. */
	lived = $state(0);
	/** Raw distance to the nearest predator, in px. Infinity when there is no predator at all. */
	distance = $state(Infinity);
	/** Bearing to the threat, in degrees. */
	directionDeg = $state(0);
	/** Closing speed: positive = it is gaining on you, negative = it is falling away. */
	closing = $state(0);
	/** Distance to the wall ahead, in px. */
	wallAhead = $state(0);
	/** Is the predator inside this fish's vision range at all? */
	inVision = $state(false);
	/** The normalised input values (0–1) the network was actually fed — what the bars fill to. */
	distanceInput = $state(0);
	closingInput = $state(0);
	wallInput = $state(0);
	/** The motor outputs the brain produced: turn is −1…1 (left…right), thrust 0…1. */
	turn = $state(0);
	thrust = $state(0);

	syncFrom(sense: SenseSnapshot): void {
		this.lived = sense.fitness;
		this.distance = sense.d;
		this.directionDeg = sense.dirDeg;
		this.closing = sense.closing;
		this.wallAhead = sense.wallFront;
		this.inVision = sense.inVis;
		this.distanceInput = sense.nd;
		this.closingInput = sense.nc;
		this.wallInput = sense.nw;
		this.turn = sense.turn;
		this.thrust = sense.thrust;
	}
}

/**
 * Reactive mirror of a world's `cfg` — the half of the world the UI both READS and WRITES.
 *
 * The world itself is raw and unreactive on purpose (see the file header), which is right for the
 * 20 fish being mutated 60×/s, but wrong for the config: a tile has to re-render the moment you
 * rename it or cut one of its senses. Rather than proxy the whole hot world for the sake of twelve
 * fields, the config is mirrored here.
 *
 * `cfg` stays the single source of truth — this is only ever projected FROM it, and only the store
 * writes to `cfg`, so the two cannot drift.
 */
export class WorldConfigView {
	name = $state('');
	accent = $state('');
	prey = $state(0);
	preds = $state(0);
	bw = $state(0);
	bh = $state(0);
	predSpeed = $state(1);
	/** The shark's hunger ramp — off, it is the same hunter all run long. */
	persistence = $state(false);
	persistRamp = $state(0.04);
	persistMaxBoost = $state(0.85);
	persistMaxJaw = $state(20);
	vision = $state(0);
	mutation = $state(0);
	caption = $state('');
	senses = $state<Senses>({ dist: false, dir: false, closing: false, walls: false });

	syncFrom(cfg: WorldConfig): void {
		this.name = cfg.name;
		this.accent = cfg.accent;
		this.prey = cfg.prey;
		this.preds = cfg.preds;
		this.bw = cfg.bw;
		this.bh = cfg.bh;
		this.predSpeed = cfg.predSpeed;
		// the engine's own fallbacks, so the sliders read the ramp the world would actually use
		this.persistence = cfg.persistence ?? true;
		this.persistRamp = cfg.persistRamp ?? 0.04;
		this.persistMaxBoost = cfg.persistMaxBoost ?? 0.85;
		this.persistMaxJaw = cfg.persistMaxJaw ?? 20;
		this.vision = cfg.vision;
		this.mutation = cfg.mutation;
		this.caption = cfg.caption;
		// A fresh object, not a mutation: `senses` is $state.raw-ish in spirit — replaced wholesale,
		// so one assignment wakes every reader exactly once.
		this.senses = { ...cfg.senses };
	}
}

export interface WorldEntry {
	readonly id: string;
	/** The raw engine world — deliberately NOT reactive (see above). */
	readonly world: World;
	readonly stats: WorldStats;
	/** Reactive view of `world.cfg` — what components bind to. */
	readonly config: WorldConfigView;
}

/** Build the pair of projections a world needs, already synced to it. */
export function makeEntry(id: string, world: World): WorldEntry {
	const stats = new WorldStats();
	const config = new WorldConfigView();
	stats.syncFrom(world);
	config.syncFrom(world.cfg);
	return { id, world, stats, config };
}
