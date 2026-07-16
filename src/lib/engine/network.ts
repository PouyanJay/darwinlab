/**
 * The neural network — a tiny fully-connected MLP. Faithful port of engine2.js.
 *
 * Shape: N inputs → 6 hidden (tanh) → 2 outputs. One bias per hidden and output neuron.
 * Genome laid out as:
 *   [ NHID*nin input→hidden | NHID hidden biases | NOUT*NHID hidden→output | NOUT output biases ]
 *
 * Input slots (a disabled sense feeds 0 → a true ablation, see sensing.ts):
 *   0 bias · 1 distance · 2 dir→x · 3 dir→y · 4 closing · 5 wall L · 6 wall F · 7 wall R
 *   8 own speed  ← the PROPRIOCEPTIVE slot, present only in 9-input worlds
 *   9 shoal density · 10 shoal→x · 11 shoal→y  ← COHESION, present only in 14-input worlds
 *   12 align→x · 13 align→y  ← ALIGNMENT (the mean heading of nearby neighbours)
 *
 * WHY THE INPUT COUNT IS DERIVED FROM THE GENOME, not a global constant: the reference
 * engine's brain has exactly 8 inputs and 68 weights, and the fidelity gate asserts our
 * numbers match it bit for bit. A world that gives its fish a sense of their own speed
 * needs a 9th slot — and therefore 74 weights — so the shape has to be a property of the
 * genome, not of the module. Reference worlds keep 68 weights and stay bit-exact; only a
 * world that asks for the extra slot pays for it.
 */

import { GENOME_INIT_SCALE } from './constants';
import { randn, type Rng, defaultRng } from './rng';
import type { Genome, ForwardResult, Senses } from './types';

/** The reference brain's input count (bias + 4 senses across 7 slots). */
export const NIN = 8;
/** With the proprioceptive slot: the fish can feel its own speed. */
export const NIN_WITH_SPEED = 9;
/** With the shoal sense (cohesion slots 9–11 + alignment slots 12–13): the fish can feel its shoal. */
export const NIN_WITH_SHOAL = 14;
export const NHID = 6;
export const NOUT = 2;

/** Weight count for a brain with `nin` inputs and `nhid` hidden neurons. The reference brain: 68. */
export function genomeLength(nin: number = NIN, nhid: number = NHID): number {
	return nhid * nin + nhid + NOUT * nhid + NOUT;
}
/** Genome length of the REFERENCE brain: 6*8 + 6 + 2*6 + 2 = 68. */
export const GLEN = genomeLength(NIN);

/**
 * How many inputs this genome was built for. The genome length alone is ambiguous once the hidden
 * layer can vary (L = nhid·nin + nhid + 2·nhid + 2 has two unknowns), so the caller must say how many
 * hidden neurons the brain has — which it always knows, from the world's `brainHidden`. Defaults to
 * the reference NHID, so every existing call and the fidelity gate are unchanged.
 */
export function inputCount(g: Genome, nhid: number = NHID): number {
	return (g.length - nhid - NOUT * nhid - NOUT) / nhid;
}

export const IN_LABELS = [
	'bias',
	'distance',
	'dir → x',
	'dir → y',
	'closing',
	'wall L',
	'wall F',
	'wall R',
	'own speed',
	'shoal density',
	'shoal → x',
	'shoal → y',
	'align → x',
	'align → y'
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
	'walls',
	'speed',
	'cohesion',
	'cohesion',
	'cohesion',
	'align',
	'align'
];
export const OUT_LABELS = ['turn', 'thrust'];

/** A fresh random genome — each weight `randn() * 0.8` (gaussian init). */
export function makeGenome(rng: Rng = defaultRng, nin: number = NIN, nhid: number = NHID): Genome {
	const len = genomeLength(nin, nhid);
	const g = new Float64Array(len);
	for (let i = 0; i < len; i++) g[i] = randn(rng) * GENOME_INIT_SCALE;
	return g;
}

/**
 * Forward pass. Returns motor outputs plus hidden/output activations for the brain viz.
 * `turn = tanh(o0)` ∈ [−1,1]; `thrust = sigmoid(o1)` ∈ [0,1].
 *
 * The genome's own length decides how many inputs are read, so an 8-input brain in a
 * 9-input world simply never sees the extra slot (and vice versa is impossible: a fish
 * only ever meets the input vector its world builds).
 */
export function forward(g: Genome, x: number[], nhid: number = NHID): ForwardResult {
	const nin = inputCount(g, nhid);
	const h = new Array<number>(nhid);
	let p = 0;
	for (let j = 0; j < nhid; j++) {
		let s = 0;
		for (let i = 0; i < nin; i++) s += g[p++] * (x[i] ?? 0);
		h[j] = Math.tanh(s + g[nhid * nin + j]);
	}
	const o = new Array<number>(NOUT);
	let q = nhid * nin + nhid;
	for (let k = 0; k < NOUT; k++) {
		let s = 0;
		for (let j = 0; j < nhid; j++) s += g[q++] * h[j];
		s += g[nhid * nin + nhid + NOUT * nhid + k];
		o[k] = s;
	}
	const turn = Math.tanh(o[0]);
	const thrust = 1 / (1 + Math.exp(-o[1]));
	return { turn, thrust, h, o: [turn, thrust] };
}

/** Weight from input `i` into hidden neuron `j`. */
export function weightIH(g: Genome, j: number, i: number, nhid: number = NHID): number {
	return g[j * inputCount(g, nhid) + i];
}

/** Weight from hidden neuron `j` into output `k`. */
export function weightHO(g: Genome, k: number, j: number, nhid: number = NHID): number {
	const nin = inputCount(g, nhid);
	return g[nhid * nin + nhid + k * nhid + j];
}
