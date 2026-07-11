/**
 * The neural network — a tiny fully-connected MLP. Faithful port of engine2.js.
 *
 * Shape: 8 inputs → 6 hidden (tanh) → 2 outputs. One bias per hidden and output neuron.
 * Genome = the 68 weights, laid out as:
 *   [ NHID*NIN input→hidden | NHID hidden biases | NOUT*NHID hidden→output | NOUT output biases ]
 *
 * Fixed input slots (a disabled sense feeds 0 → a true ablation, see sensing.ts):
 *   0 bias · 1 distance · 2 dir→x · 3 dir→y · 4 closing · 5 wall L · 6 wall F · 7 wall R
 */

import { GENOME_INIT_SCALE } from './constants';
import { randn, type Rng, defaultRng } from './rng';
import type { Genome, ForwardResult, Senses } from './types';

export const NIN = 8;
export const NHID = 6;
export const NOUT = 2;
/** Genome length: NHID*NIN (48) + NHID (6) + NOUT*NHID (12) + NOUT (2) = 68. */
export const GLEN = NHID * NIN + NHID + NOUT * NHID + NOUT;

export const IN_LABELS = [
	'bias',
	'distance',
	'dir → x',
	'dir → y',
	'closing',
	'wall L',
	'wall F',
	'wall R'
];
/** Which sense gates each input slot (null = ungated, always on). */
export const IN_SENSE: (keyof Senses | null)[] = [
	null,
	'dist',
	'dir',
	'dir',
	'closing',
	'walls',
	'walls',
	'walls'
];
export const OUT_LABELS = ['turn', 'thrust'];

/** A fresh random genome — each weight `randn() * 0.8` (gaussian init). */
export function makeGenome(rng: Rng = defaultRng): Genome {
	const g = new Float64Array(GLEN);
	for (let i = 0; i < GLEN; i++) g[i] = randn(rng) * GENOME_INIT_SCALE;
	return g;
}

/**
 * Forward pass. Returns motor outputs plus hidden/output activations for the brain viz.
 * `turn = tanh(o0)` ∈ [−1,1]; `thrust = sigmoid(o1)` ∈ [0,1].
 */
export function forward(g: Genome, x: number[]): ForwardResult {
	const h = new Array<number>(NHID);
	let p = 0;
	for (let j = 0; j < NHID; j++) {
		let s = 0;
		for (let i = 0; i < NIN; i++) s += g[p++] * x[i];
		h[j] = Math.tanh(s + g[NHID * NIN + j]);
	}
	const o = new Array<number>(NOUT);
	let q = NHID * NIN + NHID;
	for (let k = 0; k < NOUT; k++) {
		let s = 0;
		for (let j = 0; j < NHID; j++) s += g[q++] * h[j];
		s += g[NHID * NIN + NHID + NOUT * NHID + k];
		o[k] = s;
	}
	const turn = Math.tanh(o[0]);
	const thrust = 1 / (1 + Math.exp(-o[1]));
	return { turn, thrust, h, o: [turn, thrust] };
}

/** Weight from input `i` into hidden neuron `j`. */
export function weightIH(g: Genome, j: number, i: number): number {
	return g[j * NIN + i];
}

/** Weight from hidden neuron `j` into output `k`. */
export function weightHO(g: Genome, k: number, j: number): number {
	return g[NHID * NIN + NHID + k * NHID + j];
}
