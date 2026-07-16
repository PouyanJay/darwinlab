/**
 * The world: agents, the per-tick simulation, and the generation/deployment lifecycle.
 * Faithful port of engine2.js. Deep predator/persistence/wall magic numbers are kept
 * INLINE and verbatim (safest against transcription error); only the documented,
 * cross-referenced knobs come from constants.ts.
 *
 * All randomness draws from `w.rng`, so a seeded world evolves reproducibly.
 *
 * Two vestigial functions from the reference (`reseedTrained`, `trainedGenome`/`edgeSpawn`)
 * are intentionally NOT ported: they are never called, and deployed mode does not respawn
 * (CLAUDE.md gotcha). The population must decay to zero after training.
 */

import { TAU, clamp, lerpAngle } from './math';
import { rnd, type Rng, defaultRng } from './rng';
import {
	GEN_DURATION,
	MAXSPEED,
	MAXTURN,
	RESP,
	CURVE_SMOOTH_PREV,
	CURVE_SMOOTH_RAW,
	CURVE_MAX_POINTS,
	DECAY_SAMPLE_INTERVAL,
	CONFUSION_RADIUS,
	CONFUSION_CROWD_CAP,
	CONFUSION_MAX_JITTER,
	CONFUSION_TELEGRAPH_K,
	CONFUSION_CATCH_SHRINK,
	ISOLATION_WEIGHT,
	LOCK_LOSS_RATE,
	DISTRACT_TIME
} from './constants';
import { makeGenome, forward, NIN } from './network';
import { cloneGenome, breed } from './genetics';
import { senseInputs } from './sensing';
import { meanNearestNeighbor } from './flock';
import type { World, WorldConfig, Fish, Predator, Genome } from './types';

/**
 * Whether a world's brains carry the shoal senses — declared, on OR off. The one place this
 * question is answered: the emergence-curve recording here, the live readout in WorldStats, and the
 * density field in drawWorld all import it, so a third shoal sense would only ever be added once.
 */
export function isSchoolingWorld(cfg: WorldConfig): boolean {
	return 'cohesion' in cfg.senses || 'align' in cfg.senses;
}
/** Seconds between nearest-neighbour samples for the emergence curve (cheaper than every tick). */
const SCHOOL_SAMPLE_INTERVAL = 0.25;

// ---- agents ----

export function makeFish(cfg: WorldConfig, genome?: Genome, rng: Rng = defaultRng): Fish {
	return {
		x: rnd(rng, 40, cfg.bw - 40),
		y: rnd(rng, 40, cfg.bh - 40),
		vx: rnd(rng, -20, 20),
		vy: rnd(rng, -20, 20),
		heading: rnd(rng, 0, TAU),
		trail: [],
		phase: rnd(rng, 0, TAU),
		size: rnd(rng, 0.85, 1.15),
		// a fresh brain is built to THIS world's shape — 8 inputs (the reference brain, 68
		// weights) or 9, when the world lets its fish feel their own speed (74 weights)
		genome: genome ?? makeGenome(rng, cfg.brainInputs ?? NIN),
		fitness: 0,
		turn: 0,
		thrust: 0,
		trailT: 0
	};
}

export function makePred(cfg: WorldConfig, rng: Rng = defaultRng): Predator {
	return {
		x: rnd(rng, 60, cfg.bw - 60),
		y: rnd(rng, 60, cfg.bh - 60),
		vx: 0,
		vy: 0,
		heading: rnd(rng, 0, TAU),
		lunge: 0,
		cool: rnd(rng, 0.5, 1.5),
		aim: 0,
		trail: [],
		trailT: 0
	};
}

export function makeWorld(cfg: WorldConfig, genomes?: Genome[], rng: Rng = defaultRng): World {
	const w: World = {
		cfg,
		rng,
		fish: [],
		roster: [],
		preds: [],
		eaten: 0,
		bursts: [],
		selFish: null,
		hover: null,
		sense: null,
		dust: [],
		t: rnd(rng, 0, 50),
		transform: null,
		gen: 0,
		genT: 0,
		curve: [],
		lifeCurve: [],
		champion: null,
		best: null,
		championFish: null,
		lastSurv: 1,
		lastLife: 1,
		schoolCurve: [],
		_nndSum: 0,
		_nndN: 0,
		_schoolT: 0,
		maxGen: 0,
		_deployed: false,
		deployT: 0,
		decay: [],
		decayT: 0,
		extinctT: null,
		deployStartN: 0,
		halfLife: null,
		sinceKill: 0
	};
	spawnGeneration(w, genomes);
	// FIDELITY QUIRK (do not "fix" without re-measuring §8): spawnGeneration already created
	// cfg.preds predators; the reference adds cfg.preds MORE here, so a fresh world starts
	// generation 0 with 2× predators. The first evolve()/applyCfg normalizes back to
	// cfg.preds, so only the gen-0 massacre is affected — converged numbers are unchanged.
	for (let i = 0; i < cfg.preds; i++) w.preds.push(makePred(cfg, rng));
	for (let i = 0; i < 24; i++) {
		w.dust.push({
			x: rnd(rng, 0, 1),
			y: rnd(rng, 0, 1),
			r: rnd(rng, 0.6, 1.7),
			s: rnd(rng, 3, 9),
			p: rnd(rng, 0, 9)
		});
	}
	return w;
}

function spawnGeneration(w: World, genomes?: Genome[]): void {
	const c = w.cfg;
	w.fish = [];
	w.roster = [];
	w.eaten = 0;
	w.genT = 0;
	w.bursts = [];
	// Every fish that could have been selected or hovered is about to be replaced by its offspring.
	// Leaving the pointers behind would keep a whole generation alive in memory and — worse — would
	// let the UI go on presenting a fish that no longer exists as if it were still swimming: its
	// position frozen, its "live" brain no longer running. The engine already does this when a fish
	// is eaten (see the catch path); a generation ending is the same death, in bulk.
	w.selFish = null;
	w.sense = null;
	w.hover = null;
	for (let i = 0; i < c.prey; i++) {
		const g =
			genomes && genomes[i] ? cloneGenome(genomes[i]) : makeGenome(w.rng, c.brainInputs ?? NIN);
		const f = makeFish(c, g, w.rng);
		w.fish.push(f);
		w.roster.push(f);
	}
	w.preds = [];
	for (let i = 0; i < c.preds; i++) w.preds.push(makePred(c, w.rng));
}

/** Restart evolution from random brains (a fresh gen 0). */
export function resetWorld(w: World): void {
	w.gen = 0;
	w.curve = [];
	w.lifeCurve = []; // the learning curve the UI plots — a reset world has learned nothing
	w.schoolCurve = [];
	w._nndSum = 0;
	w._nndN = 0;
	w._schoolT = 0;
	w.champion = null;
	w.best = null;
	w.championFish = null;
	w.selFish = null;
	w.sense = null;
	w.hover = null;
	// The last real-world run belonged to the population that just got wiped, and that population no
	// longer exists. Leaving its decay curve and its half-life behind would put "wiped out · 37s" and
	// a red death curve on a world that is now at generation 0 and evolving — a reading from a run
	// that is not this one. (The reference leaves them; it is the same lie there.)
	w._deployed = false;
	w.deployT = 0;
	w.decay = [];
	w.decayT = 0;
	w.halfLife = null;
	w.extinctT = null;
	w.deployStartN = 0;
	spawnGeneration(w);
}

/** Apply live config edits (counts, size) to the current generation without wiping learning. */
export function applyCfg(w: World): void {
	const c = w.cfg;
	while (w.fish.length < c.prey - w.eaten && w.roster.length < c.prey) {
		const seed = w.champion
			? cloneGenome(w.champion.genome)
			: w.roster[0]
				? cloneGenome(w.roster[0].genome)
				: undefined;
		const f = makeFish(c, seed, w.rng);
		w.fish.push(f);
		w.roster.push(f);
	}
	while (w.fish.length > c.prey) {
		const f = w.fish.pop()!;
		const ri = w.roster.indexOf(f);
		if (ri >= 0) w.roster.splice(ri, 1);
		if (w.selFish === f) {
			w.selFish = null;
			w.sense = null;
		}
	}
	while (w.preds.length < c.preds) w.preds.push(makePred(c, w.rng));
	while (w.preds.length > c.preds) w.preds.pop();
	for (const f of w.fish) {
		f.x = clamp(f.x, 8, c.bw - 8);
		f.y = clamp(f.y, 8, c.bh - 8);
	}
}

/** Generation boundary: rank the roster, record survival, preserve the champion, breed, respawn. */
function evolve(w: World): void {
	const c = w.cfg;
	const ranked = w.roster.slice().sort((a, b) => b.fitness - a.fitness);
	// survival metric = fraction that survived, lightly smoothed so the trend reads through noise
	const raw = w.fish.length / Math.max(1, c.prey);
	const prev = w.curve.length ? w.curve[w.curve.length - 1] : raw;
	const surv = prev * CURVE_SMOOTH_PREV + raw * CURVE_SMOOTH_RAW;
	w.lastSurv = surv;
	w.curve.push(surv);
	if (w.curve.length > CURVE_MAX_POINTS) w.curve.shift();

	/*
	 * The LIFE curve — what selection actually rewards.
	 *
	 * `curve` above asks a yes/no question (were you alive when the bell rang?), and in a tank
	 * where almost everyone dies it flattens to a few percent for every world alike: a fish that
	 * lasted 18 of 20 seconds and one eaten at second 2 score the same zero. Fitness is SECONDS
	 * SURVIVED, so this is the curve that can actually see a brain improving — mean fitness across
	 * the whole roster, as a share of the generation. Same smoothing, same cap.
	 * (`curve` is left exactly as the reference computes it: the fidelity gate compares it.)
	 */
	const meanLife = w.roster.length
		? w.roster.reduce((sum, f) => sum + f.fitness, 0) / w.roster.length
		: 0;
	const rawLife = clamp(meanLife / (c.genDuration ?? GEN_DURATION), 0, 1);
	const prevLife = w.lifeCurve.length ? w.lifeCurve[w.lifeCurve.length - 1] : rawLife;
	const life = prevLife * CURVE_SMOOTH_PREV + rawLife * CURVE_SMOOTH_RAW;
	w.lastLife = life;
	w.lifeCurve.push(life);
	if (w.lifeCurve.length > CURVE_MAX_POINTS) w.lifeCurve.shift();

	// THE EMERGENCE CURVE — flush this generation's mean nearest-neighbour distance (the school's
	// tightness), then reset the accumulators. Only ever populated for schooling worlds (the
	// accumulators stay 0 otherwise), so the sense ladder and the fidelity reference skip it.
	if (w._nndN > 0) {
		w.schoolCurve.push(w._nndSum / w._nndN);
		if (w.schoolCurve.length > CURVE_MAX_POINTS) w.schoolCurve.shift();
		w._nndSum = 0;
		w._nndN = 0;
	}
	const best = ranked[0];
	if (best && (!w.champion || best.fitness > w.champion.fitness)) {
		w.champion = { genome: cloneGenome(best.genome), fitness: best.fitness, gen: w.gen };
	}
	/*
	 * THE BEST OF THIS GENERATION — which is not the same thing as `champion`, and the difference
	 * matters more than it looks.
	 *
	 * `champion` is the best fitness EVER, and it only updates on a strictly greater score. But
	 * fitness is seconds survived, and it is capped by the generation's length: the moment any fish
	 * survives a whole generation it scores the maximum, and no later fish can ever beat it — only
	 * tie. So `champion` FREEZES, permanently, on the first fish to run the clock out, and by
	 * generation ninety it is a fossil from generation five that got lucky.
	 *
	 * That is the reference engine's elitism and it stays exactly as it is (the fidelity gate pins
	 * it). But anything that wants to show a human "the brain this population has NOW" — the exhibit
	 * — must ask this instead. Nothing else reads it, and it consumes no RNG, so the bit-exact port
	 * is untouched.
	 */
	w.best = best ? { genome: cloneGenome(best.genome), fitness: best.fitness, gen: w.gen } : null;
	const next = breed(ranked, c, w.champion, w.rng);
	w.gen++;
	spawnGeneration(w, next);
}

/**
 * Deploy lifecycle: latch the transition when training ends, then track elapsed time, sample
 * the decay curve, and capture half-life / extinction. NO respawns here — the population only
 * goes down (CLAUDE.md gotcha).
 */
function updateDeployment(w: World, dt: number, trained: boolean): void {
	if (trained && !w._deployed) {
		w._deployed = true;
		w.eaten = 0;
		w.deployT = 0;
		w.decay = [];
		w.decayT = 0;
		w.extinctT = null;
		w.halfLife = null;
		w.deployStartN = w.fish.length || w.cfg.prey;
	}
	if (!trained) w._deployed = false;
	if (trained) {
		w.deployT += dt;
		w.decayT += dt;
		if (w.decayT >= DECAY_SAMPLE_INTERVAL) {
			w.decay.push(w.fish.length / Math.max(1, w.deployStartN));
			if (w.decay.length > CURVE_MAX_POINTS) w.decay.shift();
			w.decayT = 0;
		}
		if (w.halfLife === null && w.fish.length <= w.deployStartN / 2) w.halfLife = w.deployT;
		if (w.fish.length === 0 && w.extinctT === null) w.extinctT = w.deployT;
	}
}

/** Nearest fish to `p`, skipping any already claimed. Iteration order is preserved so ties break identically. */
function nearestFish(
	fish: Fish[],
	p: Predator,
	skip: Set<Fish> | null
): { best: Fish | null; bd: number } {
	let best: Fish | null = null;
	let bd = 1e9;
	for (const f of fish) {
		if (skip?.has(f)) continue;
		const d = Math.hypot(f.x - p.x, f.y - p.y);
		if (d < bd) {
			bd = d;
			best = f;
		}
	}
	return { best, bd };
}

/**
 * Scratch set reused across ticks to avoid a per-frame allocation in the hot loop.
 * Safe because `stepWorld` is synchronous and non-reentrant; it is cleared on every use and
 * never observed outside `assignPredatorTargets`.
 */
const claimedScratch = new Set<Fish>();

/**
 * Give each shark a DISTINCT target (greedy nearest-unclaimed) so they spread across the
 * population instead of dogpiling one fish. If everything is claimed, fall back to the
 * nearest overall.
 *
 * ISOLATION-HUNTING (confusion on): a fish's targeting score is its distance PLUS a penalty for how
 * crowded it is, so the shark passes over a surrounded fish for the exposed one. This is the whole
 * reason a school pays — the interior is the safe place — and it is a bias, not a rule: `_td` stays
 * the true distance (the strike still arms on real range), and the least-crowded fish is always
 * targetable, so a group is never uncatchable. Off (default), score = distance and this is the
 * reference's exact nearest-unclaimed pick (no crowd scan, bit-exact).
 */
/**
 * PREDATOR ATTENTION targeting: a locked shark HOLDS its target across ticks (so a dense swarm can
 * later shake it — see updatePredators) rather than re-picking the nearest every frame; a distracted
 * one (just lost a lock in a crowd) holds none and mills. Returns true when the target is settled for
 * this tick and the caller should skip re-acquisition.
 */
function retainLock(p: Predator, w: World): boolean {
	if ((p._distract ?? 0) > 0) {
		p._tgt = null;
		p._td = 1e9;
		return true;
	}
	if (p._tgt && w.fish.includes(p._tgt)) {
		p._td = Math.hypot(p._tgt.x - p.x, p._tgt.y - p.y);
		return true;
	}
	return false;
}

function assignPredatorTargets(w: World): void {
	const claimed = claimedScratch;
	claimed.clear();
	const confuse = (w.cfg.confusion ?? false) && (w.cfg.confusionIsolate ?? true);
	const lockOn = (w.cfg.confusion ?? false) && (w.cfg.confusionLock ?? false);
	const R = w.cfg.confusionRadius ?? CONFUSION_RADIUS;
	const cap = w.cfg.confusionCrowdCap ?? CONFUSION_CROWD_CAP;
	const isolationPenalty = ISOLATION_WEIGHT * (w.cfg.confusionStrength ?? 1);
	for (const p of w.preds) {
		// A locked shark that still has a valid target keeps it (or mills, if distracted); only when
		// it needs a fresh one does it run the acquisition below.
		if (lockOn && retainLock(p, w)) continue;
		let best: Fish | null = null;
		let bestScore = Infinity;
		let bd = 1e9;
		for (const f of w.fish) {
			// the distinct-target claim only applies to the stateless (no-lock) hunt; a locked shark
			// acquires independently, so two may share a target — the swarm still shakes each.
			if (!lockOn && claimed.has(f)) continue;
			const d = Math.hypot(f.x - p.x, f.y - p.y);
			const score = confuse ? d + crowdAround(f, w.fish, R, cap) * isolationPenalty : d;
			if (score < bestScore) {
				bestScore = score;
				best = f;
				bd = d;
			}
		}
		if (!best && !lockOn) {
			// everything claimed — take the nearest overall so a shark never idles mid-hunt
			({ best, bd } = nearestFish(w.fish, p, null));
		} else if (best && !lockOn) {
			claimed.add(best);
		}
		p._tgt = best;
		p._td = bd;
	}
}

/**
 * THE CONFUSION EFFECT — how crowded the shark's target is, 0 (a loner) to 1 (a full swarm).
 *
 * This is the only thing that makes grouping pay: nothing rewards a fish for schooling, but a
 * crowded target is one the shark strikes late and wide (see updatePredators). The count excludes
 * the target itself and saturates at CONFUSION_CROWD_CAP. Nothing about flocking is programmed here
 * — this makes a swarm SAFER; whether swarms then evolve is what the bench measures.
 */
function crowdAround(target: Fish, fish: Fish[], radius: number, cap: number): number {
	let n = 0;
	for (const o of fish) {
		if (o === target) continue;
		if (Math.hypot(o.x - target.x, o.y - target.y) < radius) n++;
	}
	return Math.min(1, n / cap);
}

/** The confusion sub-mechanisms, each named and gated so a reference world runs none of them (and
 *  so draws no extra randomness — the two that roll rng, lock-loss and jitter, only fire on the
 *  worlds that opt in, which is what keeps the fidelity gate bit-exact). `strength`/`R`/`cap` are
 *  resolved once by the caller (updatePredators) and threaded through. */

/** PREDATOR ATTENTION: age the shark's distraction, then roll for lock-loss — the denser the crowd
 *  around the LOCKED target, the likelier it loses the fish and mills. A fish that dives into a swarm
 *  when chased shakes the hunter; a loner never does. */
function applyPredatorAttention(
	p: Predator,
	w: World,
	dt: number,
	R: number,
	cap: number,
	strength: number
): void {
	p._distract = Math.max(0, (p._distract ?? 0) - dt);
	if (!p._tgt) return;
	const crowd = crowdAround(p._tgt, w.fish, R, cap);
	if (crowd > 0 && w.rng() < strength * crowd * LOCK_LOSS_RATE * dt) {
		p._tgt = null;
		p._td = 1e9;
		p._distract = DISTRACT_TIME;
		p.aim = 0;
		p.lunge = 0; // abort any strike mid-swarm
	}
}

/** STRIKE DEGRADATION factor (0 unless the world opts in): how packed the target is, scaled by
 *  strength. Feeds a longer telegraph and a jittered lunge vector below. */
function confusionFactor(target: Fish, w: World, R: number, cap: number, strength: number): number {
	const c = w.cfg;
	if (!((c.confusion ?? false) && (c.confusionStrike ?? true))) return 0;
	return strength * crowdAround(target, w.fish, R, cap);
}

/** Rotate a unit lunge vector by an angular error that grows with the confusion factor — a crowded
 *  target throws the committed strike off. */
function jitterVector(vx: number, vy: number, conf: number, rng: () => number): [number, number] {
	const jit = (rng() * 2 - 1) * conf * CONFUSION_MAX_JITTER;
	const cs = Math.cos(jit);
	const sn = Math.sin(jit);
	return [vx * cs - vy * sn, vx * sn + vy * cs];
}

/** THE SELFISH HERD: a fish packed among neighbours is hard to grab even on contact, so its catch
 *  radius shrinks with its own crowd (floored at 5%, so a swarm is very safe but never immortal).
 *  Off (default), every fish is caught at the same base radius. */
function catchRadiusFor(
	f: Fish,
	w: World,
	catchR: number,
	R: number,
	cap: number,
	strength: number
): number {
	const c = w.cfg;
	if (!(c.confusion && (c.confusionCatch ?? true))) return catchR;
	const crowd = crowdAround(f, w.fish, R, cap);
	return Math.max(catchR * 0.05, catchR * (1 - strength * crowd * CONFUSION_CATCH_SHRINK));
}

/** Predator physics: the cruise → aim → lunge state machine, interception, and eating. */
function updatePredators(w: World, dt: number, frust: number, catchR: number): void {
	const c = w.cfg;
	// Confusion knobs, resolved once (the reference leaves them unset, so these are their defaults
	// and cost nothing): the crowd radius, the saturation count, and the strength that scales every
	// sub-mechanism. `lockOn` gates predator attention, the one that rewrites targeting each tick.
	const R = c.confusionRadius ?? CONFUSION_RADIUS;
	const cap = c.confusionCrowdCap ?? CONFUSION_CROWD_CAP;
	const strength = c.confusionStrength ?? 1;
	const lockOn = (c.confusion ?? false) && (c.confusionLock ?? false);
	for (const p of w.preds) {
		p.cool = Math.max(0, p.cool - dt);
		p.lunge = Math.max(0, p.lunge - dt);
		if (lockOn) applyPredatorAttention(p, w, dt, R, cap, strength);
		const best = p._tgt;
		const bd = p._td ?? 1e9;
		const ps = c.predSpeed;
		const darts = c.lunge ?? true; // the strike; off, the shark only cruises and eats on contact
		if (best) {
			const commit = c.lungeCommit ?? false;
			// lunge state machine: cruise → aim (telegraphed wind-up) → lunge (fast strike)
			// ferocity only exists for committed strikes: faster, shorter-telegraphed lunges
			// that position alone can no longer dodge — feeling them COMING is the edge.
			const ferocity = commit ? (c.lungeFerocity ?? 1) : 1;
			// STRIKE DEGRADATION: how packed the target is (0 off the confusion path). It arrives two
			// ways below — a longer telegraph when the aim arms, and a jittered committed lunge vector.
			const conf = confusionFactor(best, w, R, cap, strength);
			if (!darts) {
				// No strike: the aim/lunge machine never arms, so the shark below stays in its cruise
				// branch (p.lunge and p.aim are both 0) and simply chases at cruise speed.
			} else if (p.lunge <= 0 && p.aim > 0) {
				p.aim -= dt;
				if (p.aim <= 0) {
					p.lunge = 0.4;
					// A committed strike costs more when it misses: the direction locks at THIS
					// instant, and the longer cooldown is the recovery a dodged shark visibly
					// pays, sailing past on its locked vector. (Reference: re-aims every frame
					// with cool 1.3 — a guided missile no dodge can beat.)
					p.cool = commit ? 2.4 : 1.3;
					if (commit) {
						const lead = 0.34;
						const lx = best.x + best.vx * lead;
						const ly = best.y + best.vy * lead;
						const ld = Math.hypot(lx - p.x, ly - p.y) || 1;
						let vx = (lx - p.x) / ld;
						let vy = (ly - p.y) / ld;
						// a crowded target throws the strike off; the rng draw is gated on conf > 0, so a
						// reference world draws nothing here and stays bit-exact.
						if (conf > 0) [vx, vy] = jitterVector(vx, vy, conf, w.rng);
						p._lockx = vx;
						p._locky = vy;
					}
				}
			} else if (p.lunge <= 0 && p.cool <= 0 && bd < 135) {
				// a crowd makes the shark hesitate: the telegraph stretches with the confusion factor.
				const aim = commit ? 0.3 / Math.max(1, ferocity) : 0.3;
				p.aim = aim * (1 + conf * CONFUSION_TELEGRAPH_K);
			}
			let dirx: number;
			let diry: number;
			let acc: number;
			let max: number;
			// predictive interception — lead the target's motion so predictable prey get cut off
			const lead = p.lunge > 0 ? 0.34 : 0.18;
			const lx = best.x + best.vx * lead;
			const ly = best.y + best.vy * lead;
			const ld = Math.hypot(lx - p.x, ly - p.y) || 1;
			if (p.lunge > 0 && commit && p._lockx !== undefined && p._locky !== undefined) {
				dirx = p._lockx;
				diry = p._locky;
				acc = 1000 * ps * ferocity;
				max = 430 * ps * frust * ferocity;
			} else if (p.lunge > 0) {
				dirx = (lx - p.x) / ld;
				diry = (ly - p.y) / ld;
				acc = 1000 * ps;
				max = 430 * ps * frust;
			} else if (p.aim > 0) {
				dirx = (lx - p.x) / ld;
				diry = (ly - p.y) / ld;
				// The reference wind-up BRAKES (max 40): the shark coils, so closing speed
				// collapses right before the strike and the closing sense is worse than
				// useless — it says "safe" at the exact moment it should scream. Charging
				// instead keeps closing speed rising into the strike, which is the only way
				// a fish can learn to feel a lunge coming.
				const charging = c.aimCharge ?? false;
				acc = charging ? 320 * ps : 120 * ps;
				max = charging ? 250 * ps : 40 * ps;
			} else {
				const tx = lx - p.x;
				const ty = ly - p.y;
				const td = Math.hypot(tx, ty) || 1;
				dirx = tx / td;
				diry = ty / td;
				acc = 280 * ps;
				max = 200 * ps * frust;
			}
			p.vx += dirx * acc * dt;
			p.vy += diry * acc * dt;
			const sp = Math.hypot(p.vx, p.vy);
			if (sp > max) {
				p.vx *= max / sp;
				p.vy *= max / sp;
			}
		} else {
			p.vx *= Math.pow(0.2, dt);
			p.vy *= Math.pow(0.2, dt);
		}
		const drag = p.lunge > 0 ? 0.86 : 0.42;
		p.vx *= Math.pow(drag, dt);
		p.vy *= Math.pow(drag, dt);
		p.x += p.vx * dt;
		p.y += p.vy * dt;
		// shark reaches into corners (9px clamp) so no fish is ever unreachable
		if (p.x < 9) {
			p.x = 9;
			p.vx = Math.abs(p.vx) * 0.5;
		}
		if (p.x > c.bw - 9) {
			p.x = c.bw - 9;
			p.vx = -Math.abs(p.vx) * 0.5;
		}
		if (p.y < 9) {
			p.y = 9;
			p.vy = Math.abs(p.vy) * 0.5;
		}
		if (p.y > c.bh - 9) {
			p.y = c.bh - 9;
			p.vy = -Math.abs(p.vy) * 0.5;
		}
		const psp = Math.hypot(p.vx, p.vy);
		if (psp > 12) p.heading = lerpAngle(p.heading, Math.atan2(p.vy, p.vx), Math.min(1, 6 * dt));
		p.trailT -= dt;
		if (p.trailT <= 0) {
			p.trail.push({ x: p.x, y: p.y });
			if (p.trail.length > 14) p.trail.shift();
			p.trailT = 0.05;
		}
		// eating: permanent elimination in both modes. The selfish-herd catch shrink (crowded fish
		// harder to grab) lives in catchRadiusFor; off the confusion path it returns catchR unchanged.
		for (let i = w.fish.length - 1; i >= 0; i--) {
			const f = w.fish[i];
			const cr = catchRadiusFor(f, w, catchR, R, cap, strength);
			if (Math.hypot(f.x - p.x, f.y - p.y) < cr) {
				if (w.selFish === f) {
					w.selFish = null;
					w.sense = null;
				}
				if (w.hover === f) w.hover = null;
				if (w.championFish === f) w.championFish = null;
				w.fish.splice(i, 1);
				w.sinceKill = 0;
				w.bursts.push({ x: f.x, y: f.y, a: 0, rot: rnd(w.rng, 0, TAU) });
				w.eaten++;
			}
		}
	}
}

/** Prey physics: each fish's own brain drives turn + thrust; plus separation and wall instinct. */
function updatePrey(w: World, dt: number): void {
	const c = w.cfg;
	// agility scales how fast the BODY expresses what the brain decides (turn rate and
	// velocity response) — the same evolved policy, on a sharper chassis. Reference = 1.
	const agility = c.agility ?? 1;
	for (const f of w.fish) {
		const { x } = senseInputs(w, f);
		const out = forward(f.genome, x);
		f.turn = out.turn;
		f.thrust = out.thrust;
		f.heading += out.turn * MAXTURN * agility * dt;
		// stamina (optional): sprinting above 60% thrust drains the reserve, cruising below
		// refills it, and an empty tank halves top speed. Sprint-always loses; bolting wins.
		// The agent's top speed — editable, defaulting to the reference's 176 (see cfg.maxSpeed). It is
		// the other half of the predator-speed crossover: whether fleeing escapes or only delays.
		const topSpeed = c.maxSpeed ?? MAXSPEED;
		let speedCap = topSpeed;
		if (c.stamina ?? false) {
			const reserve = f.stamina ?? 1;
			const next =
				out.thrust > 0.6 ? reserve - (out.thrust - 0.6) * 0.85 * dt : reserve + 0.28 * dt;
			f.stamina = clamp(next, 0, 1);
			if (f.stamina <= 0.02) speedCap = topSpeed * 0.55;
		}
		const target = out.thrust * speedCap;
		const dvx = Math.cos(f.heading) * target;
		const dvy = Math.sin(f.heading) * target;
		f.vx += (dvx - f.vx) * Math.min(1 / dt, RESP * agility) * dt;
		f.vy += (dvy - f.vy) * Math.min(1 / dt, RESP * agility) * dt;
		// mild positional separation so fish don't perfectly overlap (the velocity term in
		// the reference was zeroed out, so only this position nudge remains)
		for (const o of w.fish) {
			if (o === f) continue;
			const dx = f.x - o.x;
			const dy = f.y - o.y;
			const d = Math.hypot(dx, dy);
			if (d < 15 && d > 0) {
				f.x += (dx / d) * (15 - d) * 0.06;
				f.y += (dy / d) * (15 - d) * 0.06;
			}
		}
		// baseline wall-avoidance instinct — keeps fish off the glass so they never pin in
		// corners. Optional (reference = on): with it OFF, staying out of corners is
		// something only a brain with the walls sense can learn — the sense earns its keep.
		if (c.wallInstinct ?? true) {
			const wm = 54;
			if (f.x < wm) f.vx += (1 - f.x / wm) * 460 * dt;
			else if (f.x > c.bw - wm) f.vx -= (1 - (c.bw - f.x) / wm) * 460 * dt;
			if (f.y < wm) f.vy += (1 - f.y / wm) * 460 * dt;
			else if (f.y > c.bh - wm) f.vy -= (1 - (c.bh - f.y) / wm) * 460 * dt;
		}
		f.x += f.vx * dt;
		f.y += f.vy * dt;
		if (f.x < 7) {
			f.x = 7;
			f.vx *= -0.3;
		}
		if (f.x > c.bw - 7) {
			f.x = c.bw - 7;
			f.vx *= -0.3;
		}
		if (f.y < 7) {
			f.y = 7;
			f.vy *= -0.3;
		}
		if (f.y > c.bh - 7) {
			f.y = c.bh - 7;
			f.vy *= -0.3;
		}
		f.heading = Math.atan2(Math.sin(f.heading), Math.cos(f.heading));
		if (Math.hypot(f.vx, f.vy) > 6)
			f.heading = lerpAngle(f.heading, Math.atan2(f.vy, f.vx), Math.min(1, 5 * dt));
		f.fitness += dt;
		f.trailT -= dt;
		if (f.trailT <= 0) {
			f.trail.push({ x: f.x, y: f.y });
			if (f.trail.length > 10) f.trail.shift();
			f.trailT = 0.06;
		}
	}
}

/**
 * Live snapshot of the selected fish's mind, rebuilt each tick for the Brain Inspector.
 *
 * Exported because selecting a fish has to fill this in immediately: the inspector must open
 * populated even when the simulation is PAUSED, and the next tick may never come. (The reference
 * got there by stepping the world 0.0001s on every click — a real, if tiny, nudge to the physics
 * for a UI concern. Reading the mind is not a reason to move the world.)
 */
export function updateSenseSnapshot(w: World): void {
	if (!w.selFish) return;
	const f = w.selFish;
	const si = senseInputs(w, f);
	const out = forward(f.genome, si.x);
	w.sense = {
		x: si.x,
		h: out.h,
		genome: f.genome,
		d: si.dist,
		dirDeg: si.dirDeg,
		closing: si.closing,
		wallFront: si.wallFront,
		inVis: si.inVis,
		nd: si.x[1],
		nc: si.x[4],
		nw: Math.max(si.x[5], si.x[6], si.x[7]),
		turn: out.turn,
		thrust: out.thrust,
		fitness: f.fitness
	};
}

/** Age the catch bursts and drop the expired ones. */
function ageBursts(w: World, dt: number): void {
	if (w.bursts.length === 0) return; // almost always — don't reallocate an empty array per tick
	for (const b of w.bursts) b.a += dt;
	w.bursts = w.bursts.filter((b) => b.a < 0.65);
}

/**
 * Advance one tick — the core loop.
 *
 * The phases below run in EXACTLY this order; the order is load-bearing (predators act on the
 * fish's previous positions, then the fish react to the predators' new ones), and reordering
 * would change the science. Verified bit-for-bit against the reference by
 * `src/lib/harness/fidelity.spec.ts`.
 */
export function stepWorld(w: World, dt: number): void {
	const trained = !!w.maxGen && w.gen >= w.maxGen; // deployed: no more evolving, no resets
	w.t += dt;
	w.genT += dt;

	updateDeployment(w, dt, trained);

	// predator persistence: the longer without a kill, the faster the sharks get and the
	// wider their catch radius, so no stalemate lasts forever. Optional (reference = on,
	// with ramp 0.04 / boost cap 0.85 / jaw cap 20): with it off, the shark is the same
	// hunter forever, and a population that has genuinely learned is allowed to look safe.
	const persist = w.cfg.persistence ?? true;
	const frust = persist
		? 1 + Math.min(w.cfg.persistMaxBoost ?? 0.85, w.sinceKill * (w.cfg.persistRamp ?? 0.04))
		: 1;
	const catchR = persist
		? 14 + Math.min(w.cfg.persistMaxJaw ?? 20, Math.max(0, w.sinceKill - 8) * 2.2)
		: 14;
	w.sinceKill += dt;

	assignPredatorTargets(w);
	updatePredators(w, dt, frust, catchR);
	updatePrey(w, dt);
	updateSenseSnapshot(w);
	ageBursts(w, dt);

	// Emergence-curve sampling — schooling worlds only, on an interval. Off the training path
	// (deployed), the population is decaying, not evolving, so there is no generation to average
	// into; and consuming no RNG, this never touches the bit-exact reference run.
	if (!trained && isSchoolingWorld(w.cfg)) {
		w._schoolT += dt;
		if (w._schoolT >= SCHOOL_SAMPLE_INTERVAL) {
			w._schoolT = 0;
			const nnd = meanNearestNeighbor(w.fish);
			if (nnd !== null) {
				w._nndSum += nnd;
				w._nndN++;
			}
		}
	}

	// generation boundary (configurable length — past ~gen 30 the reference's 10s cap is
	// saturated by every decent fish and selection stops sharpening; longer keeps the
	// gradient alive)
	if (w.genT >= (w.cfg.genDuration ?? GEN_DURATION) || w.fish.length === 0) {
		if (trained) {
			w.genT = 0; // deployed: don't evolve, don't reset — let the population play out
		} else {
			evolve(w);
		}
	}
}

/** The highest-fitness living fish (the champion pointer). */
export function bestAliveFish(w: World): Fish | null {
	let best: Fish | null = null;
	let bf = -1;
	for (const f of w.fish) {
		if (f.fitness > bf) {
			bf = f.fitness;
			best = f;
		}
	}
	return best;
}
