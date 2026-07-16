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

/** Which inputs a world's fish brains receive. */
export interface Senses {
	dist: boolean;
	dir: boolean;
	closing: boolean;
	walls: boolean;
	/**
	 * PROPRIOCEPTION — the fish's own speed. Not a sense of the predator at all: a sense of
	 * ITSELF. Only exists in worlds whose brains carry the 9th input slot (`brainInputs: 9`);
	 * in an 8-input world this flag has nothing to gate. Reference worlds never have it.
	 */
	speed?: boolean;
	/**
	 * COHESION — the shoal. A sense of OTHER FISH, not the predator: how many neighbours are
	 * near (density) and which way their centre-of-mass lies. It is the lever cohesion needs —
	 * a brain can only steer TOWARD a group it can feel. Slots 9–11, present only in worlds
	 * whose brains carry them (`brainInputs: 14`). Reference worlds never have it.
	 */
	cohesion?: boolean;
	/**
	 * ALIGNMENT — the mean heading of nearby neighbours. What turns a clump into a school: a
	 * fish that can feel which way its shoal is pointing can swim AS ONE with it. Slots 12–13.
	 */
	align?: boolean;
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
	 * The shark CHARGES while it winds up instead of coiling.
	 *
	 * This is what makes closing speed a real sense. In the reference the aim phase BRAKES the
	 * shark to a crawl (max 40), so closing speed is at its LOWEST exactly when the strike is
	 * imminent — a brain that learned "closing fast = danger" would relax at the worst possible
	 * moment, which is why the closing sense measured as a net TAX rather than merely useless.
	 * Charging instead, closing speed rises ahead of the strike and genuinely predicts it.
	 * Reference = false.
	 */
	aimCharge?: boolean;
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
	 * How many inputs this world's brains have: 8 (the reference brain, 68 weights) or 9 —
	 * which adds the proprioceptive slot, so a fish can feel how fast IT is going and learn
	 * that running straight from something faster is death. 9-input genomes are 74 weights.
	 * A world's brain shape is fixed at creation; the `speed` sense then ablates the slot.
	 */
	brainInputs?: number;
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
	/**
	 * The agent's own top speed, px/s. Reference = MAXSPEED (176), and this is left UNSET on every
	 * reference world so the fidelity gate stays bit-exact — `cfg.maxSpeed ?? MAXSPEED` resolves to
	 * the same 176 the ported reference hardcodes.
	 *
	 * It is the OTHER half of the most consequential number on the bench. The predator cruises at
	 * 200 × predSpeed; whether a correct escape gets away or merely delays the end is decided by how
	 * that cruise compares to THIS. Editable, so the crossover is a thing you can drive rather than a
	 * constant you have to accept.
	 */
	maxSpeed?: number;
	/**
	 * Does the adversary DART — the cruise → aim → lunge strike? Reference = true (the strike is the
	 * predator's whole game). Off, it only pursues at cruise and eats whatever it catches up to.
	 *
	 * A real ablation of the adversary: it asks what the strike is worth. And it has an honest edge —
	 * a cruise-only shark below the agent's top speed can never run a good swimmer down, so with this
	 * off, a slow predator, and no hunger ramp, nothing dies and selection has nothing to sort. That
	 * is not a bug; it is the answer to "what does the dart buy?", and the UI says so.
	 */
	lunge?: boolean;

	// ---- schooling (Phase 14) — all optional, all default OFF so reference worlds and the
	//      fidelity gate are untouched (a disabled mechanic draws no randomness and changes no slot) ----
	/**
	 * THE CONFUSION EFFECT — the master switch for the reason to group. A crowded fish is a hard
	 * fish to catch, so a fish in a swarm out-survives a loner and grouping can finally pay.
	 * Reference = off (the shark treats every fish the same, so grouping buys nothing). Nothing
	 * about flocking is programmed: this only makes it PAY. Whether schools then evolve is measured.
	 *
	 * The effect is delivered by up to three sub-mechanisms, each independently ablatable so their
	 * contributions can be attributed (all default ON when confusion is on):
	 *   confusionIsolate — target acquisition: the shark passes over a surrounded fish for the
	 *                      exposed straggler (the interior of a school is safe).
	 *   confusionStrike  — the strike degrades on a crowded target: longer telegraph + a jittered
	 *                      lunge vector (it hesitates and mis-strikes).
	 *   confusionCatch   — the selfish herd: a fish packed among neighbours is hard to grab even on
	 *                      contact (its catch radius shrinks with its own crowd).
	 * Measured (predSpeed 1.05, 6 seeds × 60 gens), the shoal sense earns its keep — the population
	 * ACTIVELY schools — only with the catch/strike mechanisms in play; isolation-hunting alone did
	 * not make the sense pay. See scripts/sweep-schooling.ts.
	 */
	confusion?: boolean;
	/** Sub-mechanism: crowd-penalise target acquisition (hunt the isolated). Default on w/ confusion. */
	confusionIsolate?: boolean;
	/** Sub-mechanism: degrade the strike on a crowded target (telegraph + jitter). Default on. */
	confusionStrike?: boolean;
	/** Sub-mechanism: the selfish herd — a crowded fish is hard to grab on contact. Default on. */
	confusionCatch?: boolean;
	/**
	 * Sub-mechanism: PREDATOR ATTENTION. The shark holds a persistent lock on one target and loses
	 * it stochastically when that fish is inside a dense crowd, dropping into a distracted state
	 * where it mills and cannot strike. Passive proximity cannot cause lock-loss — only an actively
	 * maintained dense swarm can — so this is the one confusion pathway that should make TIGHT,
	 * ACTIVE schooling pay where mere clustering did not. Default OFF (opt-in). Only with confusion on.
	 */
	confusionLock?: boolean;
	/** Radius around a fish that counts toward its crowd. Reference-irrelevant; default 70px. */
	confusionRadius?: number;
	/**
	 * Neighbours needed for FULL protection (crowd saturates at this count). Default 3 — low enough
	 * that being near a couple of fish already protects, which means the benefit is captured PASSIVELY
	 * and actively schooling adds little. Raise it and only a genuinely dense, actively-formed ball is
	 * safe, so the shoal sense has to earn its keep. Only meaningful with confusion on.
	 */
	confusionCrowdCap?: number;
	/** Scales the confusion effect, 0..1. Default 1. Only meaningful with confusion on. */
	confusionStrength?: number;
	/** Radius the shoal sense (cohesion/align) summarises neighbours over. Default 70px. */
	socialRadius?: number;
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
	/** Distraction timer (s): while >0 the shark lost its lock in a swarm and mills, holding no
	 *  target and unable to strike. Only used when cfg.confusionLock is on. */
	_distract?: number;
}

/** Best genome ever seen in a world — preserved verbatim (elitism), or best of the last generation. */
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
	/** Survival-rate learning curve (fraction still alive when a generation ended). */
	curve: number[];
	/**
	 * The LIFE curve — mean seconds survived across the whole roster, as a share of the
	 * generation. This is what selection actually rewards (fitness IS seconds survived), and
	 * unlike `curve` it can still see a brain improving in a tank where almost everyone dies:
	 * a fish that lasted 18 of 20 seconds and one eaten at second 2 are the same zero to
	 * `curve`, and very different here. The UI plots this one.
	 */
	lifeCurve: number[];
	/**
	 * The best fitness EVER seen — the GA's elite, preserved verbatim into every generation.
	 *
	 * ⚠️ It SATURATES. Fitness is seconds survived and the generation caps it, so the first fish to
	 * live a whole generation scores the maximum and can only be tied, never beaten. From then on
	 * this field never changes again. It is the reference engine's elitism and it is correct as the
	 * ALGORITHM's elite — but it is a fossil as a description of what the population currently knows.
	 * To show a human the brain the population has NOW, read `best`.
	 */
	champion: Champion | null;
	/** The best fish of the LAST COMPLETED generation — what the population knows now. See `champion`. */
	best: Champion | null;
	championFish: Fish | null;
	lastSurv: number;
	/** Latest smoothed life-curve sample (0–1). */
	lastLife: number;
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
