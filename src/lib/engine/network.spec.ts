import { describe, it, expect } from 'vitest';
import {
	NIN,
	NHID,
	NOUT,
	GLEN,
	IN_SENSE,
	IN_LABELS,
	OUT_LABELS,
	makeGenome,
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
		expect(IN_LABELS).toHaveLength(NIN);
		expect(IN_SENSE).toEqual([null, 'dist', 'dir', 'dir', 'closing', 'walls', 'walls', 'walls']);
		expect(OUT_LABELS).toEqual(['turn', 'thrust']);
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
