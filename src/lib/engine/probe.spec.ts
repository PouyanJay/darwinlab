import { describe, it, expect } from 'vitest';
import { probePolicy, samplePolicyAt } from './probe';
import { updateSenseSnapshot } from './world';
import { makeGenome } from './network';
import { seededRng } from './rng';
import { testCfg, testFish, testPred } from './testkit';
import type { World, Senses } from './types';

/** Senses with everything off — the starting point for isolating one channel at a time. */
const NO_SENSES: Senses = { dist: false, dir: false, closing: false, walls: false };

describe('samplePolicyAt — the seam', () => {
	it('reproduces the sim’s own snapshot bit-for-bit', () => {
		// The probe must read the brain through the SAME sensing+forward the simulation runs, not
		// a private re-implementation. `updateSenseSnapshot` is that live path; probe the same
		// fish against the same single adversary and the motor output must be identical to the bit.
		// Sabotage: negate `turn` in samplePolicyAt, or inline a simplified sensing — this fails.
		const cfg = testCfg();
		const fish = testFish({ x: 100, y: 120, heading: 0.5, genome: makeGenome(seededRng(7)) });
		const adversary = testPred(180, 160, -50, 20);
		const w = { cfg, preds: [adversary], selFish: fish, sense: null } as unknown as World;

		updateSenseSnapshot(w);
		const s = samplePolicyAt(cfg, fish, adversary);

		expect(w.sense).not.toBeNull();
		expect(s.turn).toBe(w.sense!.turn);
		expect(s.thrust).toBe(w.sense!.thrust);
	});
});

describe('probePolicy — reading the rule off the brain', () => {
	it('a blind agent reads FLAT: position it cannot sense changes nothing', () => {
		const cfg = testCfg({ senses: { ...NO_SENSES } });
		const map = probePolicy(cfg, makeGenome(seededRng(3)));

		expect(map.flat).toBe(true);
		expect(map.turnRange[0]).toBe(map.turnRange[1]);
		expect(map.thrustRange[0]).toBe(map.thrustRange[1]);
		// Not just the summary — every cell is the one response. Opposite corners of the grid agree.
		expect(map.samples[0]).toEqual(map.samples[map.samples.length - 1]);
	});

	it('a bearing sense makes the response depend on which side the adversary is', () => {
		// Sabotage: drop the dir slots from adversaryAt / canonicalAgent and ahead==behind → fails.
		const cfg = testCfg({ senses: { ...NO_SENSES, dir: true } });
		const map = probePolicy(cfg, makeGenome(seededRng(5)));

		expect(map.flat).toBe(false);
		const r = map.radii - 1; // the outer ring, at a fixed distance
		const ahead = map.samples[0 * map.radii + r];
		const behind = map.samples[(map.bearings / 2) * map.radii + r];
		expect(ahead.turn !== behind.turn || ahead.thrust !== behind.thrust).toBe(true);
	});

	it('a distance sense is rotationally symmetric and varies with radius only', () => {
		const cfg = testCfg({ senses: { ...NO_SENSES, dist: true } });
		const map = probePolicy(cfg, makeGenome(seededRng(9)));

		// Distance is all it feels, so every bearing at one radius is the SAME response, to the bit...
		const r = 4;
		const ref = map.samples[0 * map.radii + r];
		for (let b = 1; b < map.bearings; b++) {
			expect(map.samples[b * map.radii + r].turn).toBe(ref.turn);
			expect(map.samples[b * map.radii + r].thrust).toBe(ref.thrust);
		}
		// ...but different radii differ, so the map is not flat.
		expect(map.flat).toBe(false);
	});

	it('a closing-only agent reads FLAT — this slice holds the closing rate fixed', () => {
		// An honest limit of the position map, pinned so no one "fixes" it by faking a varying
		// closing rate: with the agent at rest and the adversary bearing down at cruise, the
		// closing input is the same in every cell, so a closing-only brain cannot vary here.
		const cfg = testCfg({ senses: { ...NO_SENSES, closing: true } });
		const map = probePolicy(cfg, makeGenome(seededRng(11)));

		expect(map.flat).toBe(true);
	});

	it('spans the full grid at the requested resolution', () => {
		const cfg = testCfg();
		const map = probePolicy(cfg, makeGenome(seededRng(1)), { bearings: 24, radii: 8 });
		expect(map.samples).toHaveLength(24 * 8);
		expect(map.vision).toBe(cfg.vision);
	});
});
