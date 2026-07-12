/**
 * Engine domain types. These describe the plain data objects engine2.js builds and
 * mutates; the functions in this folder operate on them.
 *
 * Genome representation: `Float64Array`. JavaScript numbers ARE IEEE-754 float64, so the
 * network math (tanh, exp, sums) is bit-identical whether weights live in a `number[]` or
 * a `Float64Array` — there is no behavioral A/B to run. Float64Array is chosen for compact
 * storage and typed access. `cloneGenome` (`.slice()`) preserves the type.
 */

import type { Rng } from './rng';

/** The evolved brain: the 68 network weights. */
export type Genome = Float64Array;

export interface Point {
	x: number;
	y: number;
}

/** Which predator-derived inputs a world's fish brains receive. */
export interface Senses {
	dist: boolean;
	dir: boolean;
	closing: boolean;
	walls: boolean;
}

/** Per-world configuration (the Conditions schema, README §7 / spec §16). */
export interface WorldConfig {
	name: string;
	accent: string;
	prey: number;
	preds: number;
	/** Container width, logical px. */
	bw: number;
	/** Container height, logical px. */
	bh: number;
	predSpeed: number;
	vision: number;
	mutation: number;
	senses: Senses;
	caption: string;
	/** Optional seed for reproducible runs. */
	seed?: number;

	// ---- environment knobs (all optional; every default is the REFERENCE engine's behavior,
	// which is what keeps the bit-exact fidelity gate green for reference configs) ----
	/**
	 * Predator persistence: the hunger ramp that makes the shark faster and wider-jawed the
	 * longer it goes without a kill. Reference behavior = true. Off, the shark is the same
	 * hunter forever — and evolved evasion is finally allowed to LOOK safe.
	 */
	persistence?: boolean;
	/** Speed-boost ramp per hungry second (boost = min(cap, sinceKill·ramp)). Reference 0.04. */
	persistRamp?: number;
	/** Cap on the persistence speed boost. Reference 0.85 (≈1.85× top speed when starving). */
	persistMaxBoost?: number;
	/** Cap on how far the catch radius widens beyond its base 14px. Reference 20. */
	persistMaxJaw?: number;
	/**
	 * Committed lunges: the strike direction locks at launch and a miss costs a recovery, so
	 * a well-timed dodge makes the shark visibly sail past. Reference = false — the reference
	 * lunge re-aims every frame, a guided missile no dodge can beat.
	 */
	lungeCommit?: boolean;
	/**
	 * The built-in wall-avoidance force every fish gets for free. Reference = true. Off,
	 * corners are genuine death traps — and the walls SENSE has something real to earn.
	 */
	wallInstinct?: boolean;
	/** Sim-seconds per generation. Reference = 10. Longer keeps selection sharpening after champions survive whole generations. */
	genDuration?: number;
	/** Fish steering/response authority multiplier — the body, not the brain. Reference = 1. */
	agility?: number;
	/**
	 * Stamina: sprinting drains a reserve that only refills while cruising; an empty tank
	 * halves top speed. Makes "always sprint" a losing strategy, so BOLTING — calm until
	 * the threat nears, then a burst — becomes the winning, visible behavior. Reference = off.
	 */
	stamina?: boolean;
	/**
	 * Committed-lunge ferocity: multiplies the strike's speed and shortens its telegraph.
	 * At 1 (reference) a lunge can be dodged on position alone; fiercer, the only fish that
	 * escape are the ones that feel the lunge COMING — the closing-speed sense's unique job.
	 * Only meaningful with lungeCommit on.
	 */
	lungeFerocity?: number;
}

export interface Fish {
	x: number;
	y: number;
	vx: number;
	vy: number;
	heading: number;
	trail: Point[];
	phase: number;
	size: number;
	genome: Genome;
	fitness: number;
	turn: number;
	thrust: number;
	trailT: number;
	/** Sprint reserve 0..1 — only meaningful when cfg.stamina is on (starts full). */
	stamina?: number;
}

export interface Predator {
	x: number;
	y: number;
	vx: number;
	vy: number;
	heading: number;
	lunge: number;
	cool: number;
	aim: number;
	trail: Point[];
	trailT: number;
	/** Transient per-step targeting (greedy nearest-unclaimed fish + its distance). */
	_tgt?: Fish | null;
	_td?: number;
	/** Strike vector locked at lunge launch — only used when cfg.lungeCommit is on. */
	_lockx?: number;
	_locky?: number;
}

/** Best genome ever seen in a world — preserved verbatim (elitism). */
export interface Champion {
	genome: Genome;
	fitness: number;
	gen: number;
}

/** A catch marker (expanding burst) at the spot a fish was eaten. */
export interface Burst {
	x: number;
	y: number;
	a: number;
	rot: number;
}

/** A drifting particulate mote (render-only ambience). */
export interface Dust {
	x: number;
	y: number;
	r: number;
	s: number;
	p: number;
}

/** Fit-scale transform mapping logical world units → canvas pixels (set by the renderer). */
export interface Transform {
	s: number;
	ox: number;
	oy: number;
}

/** Result of `forward` — a brain's motor output plus its hidden/output activations. */
export interface ForwardResult {
	turn: number;
	thrust: number;
	h: number[];
	o: [number, number];
}

/** Result of `senseInputs` — the input vector plus derived readouts for the overlay/inspector. */
export interface SenseResult {
	x: number[];
	np: Predator | null;
	dist: number;
	inVis: boolean;
	dirDeg: number;
	closing: number;
	wallFront: number;
}

/** Live snapshot of the selected fish's mind, rebuilt each step for the inspector. */
export interface SenseSnapshot {
	x: number[];
	h: number[];
	genome: Genome;
	d: number;
	dirDeg: number;
	closing: number;
	wallFront: number;
	inVis: boolean;
	/** Normalized distance input (x[1]). */
	nd: number;
	/** Normalized closing input (x[4]). */
	nc: number;
	/** Max normalized wall input (max of x[5..7]). */
	nw: number;
	turn: number;
	thrust: number;
	fitness: number;
}

/** A running simulation: config, RNG, agents, evolution state, and deployment state. */
export interface World {
	cfg: WorldConfig;
	/** The world's random source — all evolution draws from here (reproducible if seeded). */
	rng: Rng;
	/** Currently-alive fish. */
	fish: Fish[];
	/** Full generation roster incl. eaten, kept for ranking at the generation boundary. */
	roster: Fish[];
	preds: Predator[];
	eaten: number;
	bursts: Burst[];
	selFish: Fish | null;
	hover: Fish | Predator | null;
	sense: SenseSnapshot | null;
	dust: Dust[];
	t: number;
	transform: Transform | null;
	gen: number;
	genT: number;
	/** Survival-rate learning curve across generations. */
	curve: number[];
	champion: Champion | null;
	championFish: Fish | null;
	lastSurv: number;
	/** Once `gen >= maxGen`, the world deploys (stops evolving). 0 = never deploy. */
	maxGen: number;
	_deployed: boolean;
	deployT: number;
	/** Fraction-alive samples over deployed time (the red decay curve). */
	decay: number[];
	decayT: number;
	/** Time (deployed seconds) the population hit zero, or null if still alive. */
	extinctT: number | null;
	deployStartN: number;
	/** Time (deployed seconds) the population first fell to half, or null. */
	halfLife: number | null;
	sinceKill: number;
}
