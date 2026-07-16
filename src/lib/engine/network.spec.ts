import { describe, it, expect } from 'vitest';
import {
	NIN,
	NIN_WITH_SPEED,
	NIN_WITH_SHOAL,
	NHID,
	NOUT,
	GLEN,
	IN_SENSE,
	IN_LABELS,
	OUT_LABELS,
	makeGenome,
	genomeLength,
	inputCount,
	forward,
	weightIH,
	weightHO
} from './network';
import { seededRng } from './rng';

describe('network architecture', () => {
	it('has the fixed 8→6→2 shape and 68-weight genome', () => {
		expect(NIN).toBe(8);
		expect(NHID).toBe(6);
		expect(NOUT).toBe(2);
		expect(GLEN).toBe(68);
		expect(GLEN).toBe(NHID * NIN + NHID + NOUT * NHID + NOUT);
	});

	it('labels the inputs and their gating sense correctly', () => {
		// Fourteen slots exist, but only the first eight belong to the REFERENCE brain: slot 8 is
		// proprioception (9-input worlds), slots 9–13 are the shoal sense (14-input worlds). Each is
		// read only by a world whose brains carry it.
		expect(IN_LABELS).toHaveLength(NIN_WITH_SHOAL);
		expect(IN_SENSE).toEqual([
			null,
			'dist',
			'dir',
			'dir',
			'closing',
			'walls',
			'walls',
			'walls',
			'speed',
			'cohesion',
			'cohesion',
			'cohesion',
			'align',
			'align'
		]);
		expect(IN_SENSE[NIN_WITH_SPEED - 1]).toBe('speed'); // the proprioceptive slot sits at 8
		expect(IN_LABELS.slice(0, NIN)).not.toContain('own speed');
		expect(OUT_LABELS).toEqual(['turn', 'thrust']);
	});
});

describe('brain shape (the reference brain, and the one that feels its own speed)', () => {
	it('derives the input count from the genome, so both shapes can share a bench', () => {
		expect(genomeLength(NIN)).toBe(68);
		expect(genomeLength(NIN_WITH_SPEED)).toBe(74);
		expect(inputCount(makeGenome(seededRng(1), NIN))).toBe(8);
		expect(inputCount(makeGenome(seededRng(1), NIN_WITH_SPEED))).toBe(9);
	});

	it('reads the 9th input ONLY in a 9-input brain — proof the extra slot is really wired', () => {
		const quiet = [1, 0, 0, 0, 0, 0, 0, 0, 0];
		const sprinting = [1, 0, 0, 0, 0, 0, 0, 0, 1]; // same world, same instant, but flat out

		const wide = makeGenome(seededRng(7), NIN_WITH_SPEED);
		expect(forward(wide, sprinting).turn).not.toBe(forward(wide, quiet).turn);

		// the reference brain has no such slot: the same two vectors are one and the same to it
		const reference = makeGenome(seededRng(7), NIN);
		expect(forward(reference, sprinting)).toEqual(forward(reference, quiet));
	});

	it('supports a bigger HIDDEN layer — genome, forward and weights all read the deeper shape', () => {
		// 14 inputs, 16 hidden: 16*14 + 16 + 2*16 + 2 = 274 weights
		expect(genomeLength(14, 16)).toBe(274);
		const g = makeGenome(seededRng(3), 14, 16);
		expect(g.length).toBe(274);
		// given the hidden count, the input count is derived correctly (the length alone is ambiguous)
		expect(inputCount(g, 16)).toBe(14);

		const out = forward(g, new Array<number>(14).fill(0.3), 16);
		expect(out.h).toHaveLength(16); // sixteen hidden activations, not six
		expect(out.turn).toBeGreaterThanOrEqual(-1);
		expect(out.turn).toBeLessThanOrEqual(1);
		expect(out.thrust).toBeGreaterThanOrEqual(0);
		expect(out.thrust).toBeLessThanOrEqual(1);

		// the default NHID path is untouched — same genome, same result, which is what keeps fidelity
		const ref = makeGenome(seededRng(3), NIN);
		expect(forward(ref, new Array<number>(8).fill(0.3))).toEqual(
			forward(ref, new Array<number>(8).fill(0.3), 6)
		);
	});
});

describe('makeGenome', () => {
	it('produces a Float64Array of length 68 with finite weights', () => {
		const g = makeGenome(seededRng(1));
		expect(g).toBeInstanceOf(Float64Array);
		expect(g).toHaveLength(GLEN);
		expect([...g].every(Number.isFinite)).toBe(true);
	});

	it('is reproducible for a given seed and differs across seeds', () => {
		expect([...makeGenome(seededRng(42))]).toEqual([...makeGenome(seededRng(42))]);
		expect([...makeGenome(seededRng(42))]).not.toEqual([...makeGenome(seededRng(43))]);
	});
});

describe('forward pass', () => {
	it('maps a zero genome + zero input to turn 0, thrust 0.5, and zero hidden', () => {
		const g = new Float64Array(GLEN);
		const x = new Array(NIN).fill(0);
		const out = forward(g, x);
		expect(out.turn).toBe(0);
		expect(out.thrust).toBeCloseTo(0.5, 12); // sigmoid(0)
		expect(out.h.every((v) => v === 0)).toBe(true);
		expect(out.o).toEqual([out.turn, out.thrust]);
	});

	it('routes a hand-wired sparse genome through the correct weight indices', () => {
		// hidden0 = tanh(1 * bias-input); output0 = 2 * hidden0; everything else zero.
		const g = new Float64Array(GLEN);
		g[weightIndexIH(0, 0)] = 1; // input 0 (bias) → hidden 0
		g[weightIndexHO(0, 0)] = 2; // hidden 0 → output 0
		const x = [1, 0, 0, 0, 0, 0, 0, 0];

		// the accessors read back exactly what we set
		expect(weightIH(g, 0, 0)).toBe(1);
		expect(weightHO(g, 0, 0)).toBe(2);

		const out = forward(g, x);
		const h0 = Math.tanh(1); // bias input × weight 1, no hidden bias
		expect(out.h[0]).toBeCloseTo(h0, 12);
		expect(out.h.slice(1).every((v) => v === 0)).toBe(true);
		expect(out.turn).toBeCloseTo(Math.tanh(2 * h0), 12);
		expect(out.thrust).toBeCloseTo(0.5, 12); // output1 untouched
	});
});

// index helpers mirroring the documented genome layout, used only to place test weights
function weightIndexIH(j: number, i: number): number {
	return j * NIN + i;
}
function weightIndexHO(k: number, j: number): number {
	return NHID * NIN + NHID + k * NHID + j;
}
