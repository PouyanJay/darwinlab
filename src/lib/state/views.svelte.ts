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

import { fleeError, probePolicy } from '../engine';
import type { World, WorldConfig, Senses, SenseSnapshot, Genome, PolicyMap } from '../engine';

/** Cheap reactive snapshot of one world, refreshed once per frame for the UI to bind to. */
export class WorldStats {
	alive = $state(0);
	eaten = $state(0);
	gen = $state(0);
	/** Smoothed survival rate of the latest generation, 0–100. */
	survivalPct = $state(0);
	championFitness = $state(0);
	/**
	 * The best survival time of the LAST COMPLETED generation, seconds — what the population knows now.
	 *
	 * NOT `champion.fitness`, which is the all-time elite and SATURATES: fitness is seconds survived,
	 * the generation caps it, and the elite only re-crowns on a strictly greater score — so once any
	 * fish survives a full generation the champion's time is stuck at the generation length forever.
	 * The inspector showed that stuck number (always 30.0s). `best` is re-crowned every generation, so
	 * it moves, and in a world whose best fish genuinely lasts the whole generation, 30 is the truth.
	 */
	bestFitness = $state(0);
	deployed = $state(false);
	deployT = $state(0);
	halfLife = $state<number | null>(null);
	extinctT = $state<number | null>(null);

	/** Project the raw world onto this snapshot. The projection lives with the data it produces. */
	/**
	 * What the flee lens is reading in this tank: a RUNNING mean of the error across the fish that
	 * have a reading, and how many are readable this frame.
	 *
	 * Running, and not instantaneous, because an instantaneous one is noise and lies. A single frame
	 * averages a handful of fish over a fraction of a second; measured live, a blind tank read 54°
	 * and a bearing tank read 99° — the exact reverse of what twelve seconds of the same measurement
	 * says (blind 85°, bearing 73°). A number that flips its own verdict between frames is not a
	 * reading, it is a coin, and putting it on the card next to a claim would have been indefensible.
	 *
	 * So the samples decay instead: every fish-frame is weighted, older ones fade with a half-life of
	 * a couple of seconds, and what the card prints is the mean over roughly the last few seconds of
	 * fish-time. It converges on exactly what the harness measures over a bout, it tracks a population
	 * that is still improving, and it never needs to be reset by hand.
	 *
	 * Rounded to a whole degree ON PURPOSE: this is a $state field on a 60fps path, and an unrounded
	 * float would write a new value — and re-render the card — on every single frame.
	 */
	fleeNow = $state<number | null>(null);
	/** Effective sample size in the window — the card shows it, because a mean without an n is a rumour. */
	fleeSamples = $state(0);
	fleeReadable = $state(0);

	/**
	 * Per-frame decay on the accumulators — a half-life of about twenty seconds at 60fps.
	 *
	 * It has to be this long because the readings are SPARSE: a shark is only in vision for a small
	 * fraction of the tank at any moment, so a frame contributes a handful of fish, not twenty. At a
	 * two-second half-life the number still swung from 76° to 47° in the same tank, six seconds apart
	 * — it was measuring which fish happened to be near a shark, not what the population had learned.
	 */
	static readonly LENS_DECAY = 0.9994;

	/**
	 * How much fish-time must be in the window before a number is worth printing. Under this, the card
	 * says it is still measuring rather than publishing a mean of nine samples with a straight face.
	 */
	static readonly LENS_MIN_SAMPLES = 200;

	#fleeSum = 0;
	#fleeN = 0;

	/** Only computed when the lens is on; the rest of the time it costs a branch. */
	syncLens(world: World, on: boolean): void {
		if (!on) {
			// Off means off: the next time the lens opens it must not average in a stale population's
			// readings — very likely from before this world was reset, or its senses were cut.
			this.#fleeSum = 0;
			this.#fleeN = 0;
			this.fleeNow = null;
			this.fleeSamples = 0;
			this.fleeReadable = 0;
			return;
		}

		let sum = 0;
		let n = 0;
		for (const f of world.fish) {
			const err = fleeError(world.cfg, f, world.preds);
			if (err !== null) {
				sum += err;
				n++;
			}
		}

		this.#fleeSum = this.#fleeSum * WorldStats.LENS_DECAY + sum;
		this.#fleeN = this.#fleeN * WorldStats.LENS_DECAY + n;

		this.fleeReadable = n;
		this.fleeSamples = Math.round(this.#fleeN);
		this.fleeNow =
			this.#fleeN >= WorldStats.LENS_MIN_SAMPLES ? Math.round(this.#fleeSum / this.#fleeN) : null;
	}

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
		this.bestFitness = world.best?.fitness ?? world.champion?.fitness ?? 0;
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
 * The selected fish's ESCAPE MAP — its evolved policy swept over every adversary position.
 *
 * A companion to MindView: that projects what the fish senses THIS frame; this projects the whole
 * rule the brain learned, read straight off its genome by `probePolicy`. The sweep is ~768 forward
 * passes, so it is MEMOISED — `syncFrom` recomputes only when the genome or the conditions that
 * shape the map (senses, vision, predator speed, brain width) actually change. That lets the same
 * per-frame seam that republishes the mind drive this too, at near-zero cost while the fish and its
 * world hold still, and refresh the instant a sense is cut or the tank resized.
 */
export class EscapeMapView {
	/**
	 * The swept policy for the selected fish, or null when nothing is selected. Raw on purpose: a
	 * plain data grid the canvas reads, with nothing inside it for DOM reactivity to track.
	 */
	map = $state.raw<PolicyMap | null>(null);

	#genome: Genome | null = null;
	#sig = '';

	/** Recompute the map iff the selected fish, or a condition that shapes it, has changed. */
	syncFrom(world: World): void {
		const fish = world.selFish;
		if (!fish) {
			this.clear();
			return;
		}
		const c = world.cfg;
		const s = c.senses;
		const sig = `${c.vision}|${c.predSpeed}|${c.brainInputs ?? ''}|${s.dist}${s.dir}${s.closing}${s.walls}${s.speed ?? false}`;
		if (fish.genome === this.#genome && sig === this.#sig) return;
		this.#genome = fish.genome;
		this.#sig = sig;
		this.map = probePolicy(c, fish.genome);
	}

	clear(): void {
		if (this.map === null) return; // already clear — and #genome/#sig were reset with it
		this.map = null;
		this.#genome = null;
		this.#sig = '';
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
	/** The agent's own top speed — the other half of the predator-speed crossover. */
	maxSpeed = $state(176);
	/** Does the adversary dart? Off, it only pursues at cruise. */
	lunge = $state(true);
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
		this.maxSpeed = cfg.maxSpeed ?? 176; // the engine's own fallback (MAXSPEED)
		this.lunge = cfg.lunge ?? true;
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
