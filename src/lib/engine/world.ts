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
	DECAY_SAMPLE_INTERVAL
} from './constants';
import { makeGenome, forward } from './network';
import { cloneGenome, breed } from './genetics';
import { senseInputs } from './sensing';
import type { World, WorldConfig, Fish, Predator, Genome } from './types';

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
		genome: genome ?? makeGenome(rng),
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
		champion: null,
		championFish: null,
		lastSurv: 1,
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
	for (let i = 0; i < c.prey; i++) {
		const g = genomes && genomes[i] ? cloneGenome(genomes[i]) : makeGenome(w.rng);
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
	w.champion = null;
	w.championFish = null;
	w.selFish = null;
	w.sense = null;
	w.hover = null;
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
	const best = ranked[0];
	if (best && (!w.champion || best.fitness > w.champion.fitness)) {
		w.champion = { genome: cloneGenome(best.genome), fitness: best.fitness, gen: w.gen };
	}
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
 */
function assignPredatorTargets(w: World): void {
	const claimed = claimedScratch;
	claimed.clear();
	for (const p of w.preds) {
		let { best, bd } = nearestFish(w.fish, p, claimed);
		if (!best) {
			({ best, bd } = nearestFish(w.fish, p, null));
		} else {
			claimed.add(best);
		}
		p._tgt = best;
		p._td = bd;
	}
}

/** Predator physics: the cruise → aim → lunge state machine, interception, and eating. */
function updatePredators(w: World, dt: number, frust: number, catchR: number): void {
	const c = w.cfg;
	for (const p of w.preds) {
		p.cool = Math.max(0, p.cool - dt);
		p.lunge = Math.max(0, p.lunge - dt);
		const best = p._tgt;
		const bd = p._td ?? 1e9;
		const ps = c.predSpeed;
		if (best) {
			// lunge state machine: cruise → aim (telegraphed wind-up) → lunge (fast strike)
			if (p.lunge <= 0 && p.aim > 0) {
				p.aim -= dt;
				if (p.aim <= 0) {
					p.lunge = 0.4;
					p.cool = 1.3;
				}
			} else if (p.lunge <= 0 && p.cool <= 0 && bd < 135) {
				p.aim = 0.3;
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
			if (p.lunge > 0) {
				dirx = (lx - p.x) / ld;
				diry = (ly - p.y) / ld;
				acc = 1000 * ps;
				max = 430 * ps * frust;
			} else if (p.aim > 0) {
				dirx = (lx - p.x) / ld;
				diry = (ly - p.y) / ld;
				acc = 120 * ps;
				max = 40 * ps;
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
		// eating: permanent elimination in both modes
		for (let i = w.fish.length - 1; i >= 0; i--) {
			const f = w.fish[i];
			if (Math.hypot(f.x - p.x, f.y - p.y) < catchR) {
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
	for (const f of w.fish) {
		const { x } = senseInputs(w, f);
		const out = forward(f.genome, x);
		f.turn = out.turn;
		f.thrust = out.thrust;
		f.heading += out.turn * MAXTURN * dt;
		const target = out.thrust * MAXSPEED;
		const dvx = Math.cos(f.heading) * target;
		const dvy = Math.sin(f.heading) * target;
		f.vx += (dvx - f.vx) * RESP * dt;
		f.vy += (dvy - f.vy) * RESP * dt;
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
		// baseline wall-avoidance instinct — keeps fish off the glass so they never pin in corners
		const wm = 54;
		if (f.x < wm) f.vx += (1 - f.x / wm) * 460 * dt;
		else if (f.x > c.bw - wm) f.vx -= (1 - (c.bw - f.x) / wm) * 460 * dt;
		if (f.y < wm) f.vy += (1 - f.y / wm) * 460 * dt;
		else if (f.y > c.bh - wm) f.vy -= (1 - (c.bh - f.y) / wm) * 460 * dt;
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

/** Live snapshot of the selected fish's mind, rebuilt each tick for the Brain Inspector. */
function updateSenseSnapshot(w: World): void {
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
	// wider their catch radius, so no stalemate lasts forever
	const frust = 1 + Math.min(0.85, w.sinceKill * 0.04);
	const catchR = 14 + Math.min(20, Math.max(0, w.sinceKill - 8) * 2.2);
	w.sinceKill += dt;

	assignPredatorTargets(w);
	updatePredators(w, dt, frust, catchR);
	updatePrey(w, dt);
	updateSenseSnapshot(w);
	ageBursts(w, dt);

	// generation boundary
	if (w.genT >= GEN_DURATION || w.fish.length === 0) {
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
