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
import type { WorldConfig, World } from './types';

function cfg(over: Partial<WorldConfig> = {}): WorldConfig {
	return {
		name: 'w',
		accent: '#000',
		prey: 20,
		preds: 2,
		bw: 640,
		bh: 400,
		predSpeed: 1,
		vision: 200,
		mutation: 0.06,
		senses: { dist: true, dir: true, closing: false, walls: false },
		caption: '',
		...over
	};
}

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

		// extinctT latches at the START of the tick after fish hits 0, so step until it's set
		let prev = w.fish.length;
		let steps = 0;
		while (w.extinctT === null && steps < 40000) {
			stepWorld(w, dt);
			expect(w.fish.length).toBeLessThanOrEqual(prev); // monotonic — no respawn
			prev = w.fish.length;
			steps++;
		}
		expect(w.fish).toHaveLength(0);
		expect(w.extinctT).not.toBeNull();
		expect(w.halfLife).not.toBeNull();
		expect(w.gen).toBe(genAtDeploy); // no evolving in deployed mode
		expect(w.decay.length).toBeGreaterThan(0);
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
