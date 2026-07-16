import { describe, it, expect } from 'vitest';
import {
	makeWorld,
	stepWorld,
	resetWorld,
	applyCfg,
	bestAliveFish,
	makeFish,
	makePred
} from './world';
import { GLEN } from './network';
import { seededRng } from './rng';
import type { World } from './types';
import { testCfg as cfg } from './testkit';

const dt = 1 / 60;

/** Step a world until `gen` reaches `target` or a step budget runs out. */
function stepUntilGen(w: World, target: number, maxSteps = 20000): number {
	let steps = 0;
	while (w.gen < target && steps < maxSteps) {
		stepWorld(w, dt);
		steps++;
	}
	return steps;
}

describe('makeWorld / makeFish / makePred', () => {
	it('builds prey fish, a full roster, and 68-weight genomes', () => {
		const w = makeWorld(cfg(), undefined, seededRng(1));
		expect(w.fish).toHaveLength(20);
		expect(w.roster).toHaveLength(20);
		expect(w.dust).toHaveLength(24);
		expect(w.fish[0].genome).toHaveLength(GLEN);
	});

	it('reproduces the reference gen-0 double-predator quirk (2× cfg.preds until first evolve)', () => {
		const w = makeWorld(cfg({ preds: 2 }), undefined, seededRng(1));
		expect(w.preds).toHaveLength(4); // spawnGeneration made 2, makeWorld added 2 more
	});

	it('places fish and predators inside the tank', () => {
		const c = cfg();
		const f = makeFish(c, undefined, seededRng(2));
		const p = makePred(c, seededRng(3));
		expect(f.x).toBeGreaterThanOrEqual(0);
		expect(f.x).toBeLessThanOrEqual(c.bw);
		expect(p.y).toBeGreaterThanOrEqual(0);
		expect(p.y).toBeLessThanOrEqual(c.bh);
	});
});

describe('determinism', () => {
	it('two worlds with the same seed evolve identically', () => {
		const a = makeWorld(cfg(), undefined, seededRng(12345));
		const b = makeWorld(cfg(), undefined, seededRng(12345));
		for (let i = 0; i < 400; i++) {
			stepWorld(a, dt);
			stepWorld(b, dt);
		}
		expect(a.gen).toBe(b.gen);
		expect(a.eaten).toBe(b.eaten);
		expect(a.fish.map((f) => [f.x, f.y, f.heading])).toEqual(
			b.fish.map((f) => [f.x, f.y, f.heading])
		);
		expect(a.curve).toEqual(b.curve);
	});

	it('different seeds diverge', () => {
		const a = makeWorld(cfg(), undefined, seededRng(1));
		const b = makeWorld(cfg(), undefined, seededRng(2));
		for (let i = 0; i < 400; i++) {
			stepWorld(a, dt);
			stepWorld(b, dt);
		}
		expect(a.fish.map((f) => f.x)).not.toEqual(b.fish.map((f) => f.x));
	});
});

describe('stepWorld basics', () => {
	it('advances time and accumulates fitness', () => {
		const w = makeWorld(cfg(), undefined, seededRng(1));
		const f = w.fish[0];
		stepWorld(w, dt);
		expect(w.t).toBeGreaterThan(0);
		expect(w.genT).toBeCloseTo(dt, 6);
		expect(f.fitness).toBeCloseTo(dt, 6);
	});
});

describe('generation boundary + evolve', () => {
	it('increments gen, records a survival point, repopulates, and normalizes predator count', () => {
		const w = makeWorld(cfg(), undefined, seededRng(7));
		stepUntilGen(w, 1);
		expect(w.gen).toBeGreaterThanOrEqual(1);
		expect(w.curve.length).toBeGreaterThanOrEqual(1);
		expect(w.fish).toHaveLength(20); // fresh generation
		expect(w.preds).toHaveLength(2); // the gen-0 double is gone after spawnGeneration
	});

	it('preserves a champion across generations', () => {
		const w = makeWorld(cfg(), undefined, seededRng(7));
		stepUntilGen(w, 3);
		expect(w.champion).not.toBeNull();
		expect(w.champion!.fitness).toBeGreaterThan(0);
		const champFitness = w.champion!.fitness;
		stepUntilGen(w, 5);
		// champion fitness never decreases (best-ever is preserved)
		expect(w.champion!.fitness).toBeGreaterThanOrEqual(champFitness);
	});
});

describe('deployment (post-training)', () => {
	it('never respawns and decays to extinction (corner-standoff regression)', () => {
		const w = makeWorld(cfg({ prey: 10, bw: 420, bh: 260 }), undefined, seededRng(9));
		w.maxGen = 1;
		stepUntilGen(w, 1); // train to gen 1 → next step deploys
		stepWorld(w, dt); // latch deployment
		expect(w._deployed).toBe(true);
		const genAtDeploy = w.gen;

		// extinctT latches at the START of the tick after fish hits 0, so step until it's set.
		// Record the first violation rather than asserting inside the loop (up to 40k steps).
		let prev = w.fish.length;
		let steps = 0;
		let firstRespawnAtStep = -1;
		while (w.extinctT === null && steps < 40000) {
			stepWorld(w, dt);
			if (w.fish.length > prev && firstRespawnAtStep < 0) firstRespawnAtStep = steps;
			prev = w.fish.length;
			steps++;
		}

		expect(firstRespawnAtStep).toBe(-1); // population never grew — no respawn in deployed mode
		expect(w.fish).toHaveLength(0);
		expect(w.extinctT).not.toBeNull();
		expect(w.halfLife).not.toBeNull();
		expect(w.gen).toBe(genAtDeploy); // no evolving in deployed mode
		expect(w.decay.length).toBeGreaterThan(0);
	});
});

describe('pointer cleanup when a tracked fish is eaten', () => {
	it('clears selFish, hover and championFish so no pointer dangles', () => {
		const w = makeWorld(cfg({ prey: 4, bw: 300, bh: 200 }), undefined, seededRng(21));
		const victim = w.fish[0];
		w.selFish = victim;
		w.hover = victim;
		w.championFish = victim;

		// run until that specific fish is eaten
		let steps = 0;
		while (w.fish.includes(victim) && steps < 20000) {
			stepWorld(w, dt);
			steps++;
		}

		expect(w.fish).not.toContain(victim); // it really got eaten
		expect(w.selFish).toBeNull();
		expect(w.hover).toBeNull();
		expect(w.championFish).toBeNull();
	});

	it('clears them at a generation turnover too — the whole generation is gone, not just one fish', () => {
		// NO predators, deliberately. With sharks in the tank the watched fish tends to be eaten
		// before its generation ends, and the catch path would clear the pointer — the test would
		// then pass without ever exercising the turnover it claims to be about.
		const w = makeWorld(cfg({ prey: 6, preds: 0, bw: 400, bh: 300 }), undefined, seededRng(7));
		const watched = w.fish[0];
		w.selFish = watched;
		w.hover = watched;

		while (w.gen < 1) stepWorld(w, dt); // let the generation end and the offspring spawn

		expect(w.eaten).toBe(0); // nothing was eaten: the turnover is the ONLY thing under test
		// Without this cleanup the pointer survives as a ghost, and the UI goes on drawing a fish that
		// is not in the water — frozen where it was, with a "live" brain that no longer runs.
		expect(w.fish).not.toContain(watched);
		expect(w.selFish).toBeNull();
		expect(w.hover).toBeNull();
		expect(w.sense).toBeNull();
	});
});

describe('applyCfg', () => {
	it('adjusts predator count live', () => {
		const w = makeWorld(cfg(), undefined, seededRng(1));
		w.cfg.preds = 3;
		applyCfg(w);
		expect(w.preds).toHaveLength(3);
	});

	it('shrinks the population when prey is reduced', () => {
		const w = makeWorld(cfg(), undefined, seededRng(1));
		w.cfg.prey = 12;
		applyCfg(w);
		expect(w.fish.length).toBeLessThanOrEqual(12);
		expect(w.roster.length).toBeLessThanOrEqual(12);
	});

	it('seeds fish added by a live prey increase from the champion genome (not fresh random)', () => {
		const w = makeWorld(cfg({ prey: 6 }), undefined, seededRng(4));
		stepUntilGen(w, 3); // evolve far enough to have a champion
		expect(w.champion).not.toBeNull();
		const championGenome = [...w.champion!.genome];
		const before = w.fish.length;

		w.cfg.prey = 10;
		applyCfg(w);

		expect(w.fish.length).toBeGreaterThan(before);
		const added = w.fish[w.fish.length - 1];
		expect([...added.genome]).toEqual(championGenome); // inherits the best brain, not a random one
	});
});

describe('confusion — isolation-hunting (the reason a school pays)', () => {
	/**
	 * Lay a tight cluster right next to the shark and one lone straggler farther away, then take a
	 * single tick so `assignPredatorTargets` runs on the layout we placed. With the confusion effect
	 * on, the shark must pass over the nearer crowd for the exposed fish; off, it takes the nearest.
	 * Positions are pinned by hand (makeWorld randomises), and predators trimmed to one.
	 */
	function stagedWorld(confusion: boolean): World {
		const w = makeWorld(cfg({ preds: 1, prey: 5, confusion }), undefined, seededRng(1));
		applyCfg(w); // trim the gen-0 double predators to the one this test reasons about
		const p = w.preds[0];
		p.x = 100;
		p.y = 60;
		const [lone, ...cluster] = w.fish;
		lone.x = 300; // far, but utterly alone
		lone.y = 60;
		cluster.forEach((f, i) => {
			f.x = 100 + (i - 1) * 8; // four bodies packed around (100,100), ~40px from the shark
			f.y = 100;
		});
		stepWorld(w, dt);
		return w;
	}

	it('passes over the near crowd for the isolated straggler', () => {
		const w = stagedWorld(true);
		expect(w.preds[0]._tgt).toBe(w.fish[0]); // the lone fish, though it is the FARTHEST
	});

	it('SABOTAGE: with confusion off, the same shark takes the nearest (crowded) fish', () => {
		const w = stagedWorld(false);
		expect(w.preds[0]._tgt).not.toBe(w.fish[0]); // nearest-unclaimed — a cluster fish
	});
});

describe('confusion — predator attention / lock-loss (what makes ACTIVE schooling pay)', () => {
	/**
	 * Pack every fish into one tight ball with the shark right on it. With lock-loss on, a shark
	 * whose target sits in that dense crowd should be shaken off (distracted) within a beat; off, it
	 * holds and hunts normally. confusionStrength is cranked so the (seeded) roll fires promptly, and
	 * confusionCatch is left off so the shark's inability to CATCH can't be what ends the ball.
	 */
	function swarmWorld(lock: boolean): World {
		const w = makeWorld(
			cfg({
				preds: 1,
				prey: 6,
				predSpeed: 0.3,
				confusion: true,
				confusionLock: lock,
				confusionCatch: false,
				confusionIsolate: false,
				confusionStrike: false,
				confusionStrength: 6
			}),
			undefined,
			seededRng(4)
		);
		applyCfg(w); // one shark, not the gen-0 double
		w.fish.forEach((f, i) => {
			f.x = 300 + (i % 3) * 6; // a ~12px ball, everyone inside everyone's crowd radius
			f.y = 200 + Math.floor(i / 3) * 6;
		});
		// well outside the ball and slow, so lock-loss has room to fire before the shark reaches it
		w.preds[0].x = 400;
		w.preds[0].y = 200;
		return w;
	}

	function everDistracted(w: World, steps: number): boolean {
		for (let s = 0; s < steps && w.fish.length > 0; s++) {
			stepWorld(w, dt);
			if ((w.preds[0]?._distract ?? 0) > 0) return true;
		}
		return false;
	}

	it('the shark loses its lock inside a dense swarm and mills', () => {
		expect(everDistracted(swarmWorld(true), 90)).toBe(true);
	});

	it('SABOTAGE: with lock-loss off, the same swarm never shakes the shark', () => {
		expect(everDistracted(swarmWorld(false), 90)).toBe(false);
	});
});

describe('confusion — the selfish herd (confusionCatch)', () => {
	/**
	 * Pack a population into a tight ball in a small tank and let one shark hunt it for two seconds,
	 * with the catch shrink cranked. A fish buried among neighbours is hard to grab even on contact,
	 * so far fewer are eaten than in the SAME seeded run with the shrink off — the comparison is the
	 * guard: strip the mechanic (make catchRadiusFor return the base radius) and the two runs become
	 * identical. Only the catch mechanic differs; a staged single contact is a degenerate edge (a
	 * zero-velocity shark on a fish never resolves), so this drives the real hunt instead.
	 */
	function eatenInCrowd(catchShrink: boolean): number {
		const w = makeWorld(
			cfg({
				preds: 1,
				prey: 12,
				bw: 200,
				bh: 200,
				predSpeed: 0.6,
				persistence: false,
				confusion: true,
				confusionCatch: catchShrink,
				confusionIsolate: false,
				confusionStrike: false,
				confusionLock: false,
				confusionStrength: 5
			}),
			undefined,
			seededRng(9)
		);
		w.maxGen = 1;
		w.gen = 1;
		applyCfg(w); // frozen population, one shark
		w.fish.forEach((f, i) => {
			f.x = 100 + (i % 4) * 5; // a tight ball in a small tank, so the crowd is real
			f.y = 100 + Math.floor(i / 4) * 5;
		});
		for (let s = 0; s < 120 && w.fish.length > 0; s++) stepWorld(w, dt);
		return w.eaten;
	}

	it('a packed crowd loses far fewer fish than the same run without the catch shrink', () => {
		expect(eatenInCrowd(true)).toBeLessThan(eatenInCrowd(false));
	});
});

describe('the emergence curve (schoolCurve)', () => {
	const schoolingCfg = () =>
		cfg({
			brainInputs: 14,
			senses: { dist: true, dir: true, closing: true, walls: true, cohesion: true, align: true }
		});

	it('records a mean-spacing point per generation on a schooling world', () => {
		const w = makeWorld(schoolingCfg(), undefined, seededRng(2));
		stepUntilGen(w, 4);
		// one point per completed generation, and every one a real positive distance
		expect(w.schoolCurve.length).toBeGreaterThanOrEqual(3);
		expect(w.schoolCurve.every((v) => v > 0 && Number.isFinite(v))).toBe(true);
	});

	it('SABOTAGE: a sense-ladder world (no shoal senses) never records one', () => {
		const w = makeWorld(cfg(), undefined, seededRng(2)); // default senses: no cohesion/align
		stepUntilGen(w, 4);
		expect(w.schoolCurve).toEqual([]);
		expect(w._nndN).toBe(0); // the accumulator never ran either
	});

	it('clears the curve on resetWorld, like every other learning record', () => {
		const w = makeWorld(schoolingCfg(), undefined, seededRng(2));
		stepUntilGen(w, 3);
		expect(w.schoolCurve.length).toBeGreaterThan(0);
		resetWorld(w);
		expect(w.schoolCurve).toEqual([]);
	});
});

describe('resetWorld', () => {
	it('returns to a fresh generation 0 with cleared learning', () => {
		const w = makeWorld(cfg(), undefined, seededRng(1));
		stepUntilGen(w, 2);
		resetWorld(w);
		expect(w.gen).toBe(0);
		expect(w.curve).toEqual([]);
		expect(w.champion).toBeNull();
		expect(w.fish).toHaveLength(20);
		expect(bestAliveFish(w)).not.toBeNull();
	});
});
