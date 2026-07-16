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

/**
 * Normalise a hidden-layer spec to an array of layer sizes. `undefined` → the reference single layer;
 * a bare number → one layer of that many neurons; an array → itself (an empty one falls back to the
 * reference). This is the one place a world's `brainHidden` becomes a concrete network shape.
 */
export function hiddenLayers(hidden?: number | number[]): number[] {
	if (hidden === undefined) return [NHID];
	if (typeof hidden === 'number') return [hidden];
	return hidden.length ? hidden : [NHID];
}

/** Weight count for a brain with `nin` inputs and the given hidden layers. The reference brain: 68. */
export function genomeLength(nin: number = NIN, hidden: number | number[] = NHID): number {
	const layers = hiddenLayers(hidden);
	let total = 0;
	let prev = nin;
	for (const L of layers) {
		total += L * prev + L; // weights (L×prev) + biases (L) for this layer
		prev = L;
	}
	return total + NOUT * prev + NOUT; // the output layer
}
/** Genome length of the REFERENCE brain: 6*8 + 6 + 2*6 + 2 = 68. */
export const GLEN = genomeLength(NIN);

/**
 * How many inputs this genome was built for. The genome length alone is ambiguous once the hidden
 * shape can vary, so the caller must say what the hidden layers are — which it always knows, from the
 * world's `brainHidden`. Defaults to the reference single layer, so every existing call and the
 * fidelity gate are unchanged.
 */
export function inputCount(g: Genome, hidden: number | number[] = NHID): number {
	const layers = hiddenLayers(hidden);
	const L1 = layers[0];
	// everything in the genome EXCEPT the first layer's input weights (L1×nin):
	let rest = L1; // first hidden layer's biases
	let prev = L1;
	for (let i = 1; i < layers.length; i++) {
		rest += layers[i] * prev + layers[i];
		prev = layers[i];
	}
	rest += NOUT * prev + NOUT; // output layer
	return (g.length - rest) / L1;
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
export function makeGenome(
	rng: Rng = defaultRng,
	nin: number = NIN,
	hidden: number | number[] = NHID
): Genome {
	const len = genomeLength(nin, hidden);
	const g = new Float64Array(len);
	for (let i = 0; i < len; i++) g[i] = randn(rng) * GENOME_INIT_SCALE;
	return g;
}

/**
 * Forward pass through an arbitrary-depth MLP. Returns motor outputs plus every hidden layer's
 * activations (`h[l][j]`) for the brain viz. `turn = tanh(o0)` ∈ [−1,1]; `thrust = sigmoid(o1)`.
 *
 * The genome is a flat concatenation of, per layer, its weight matrix (neuron-major: for each neuron
 * j, `prev` weights) followed by its biases; then the same for the output layer. For a single hidden
 * layer this is byte-identical to the reference brain, which is what keeps the fidelity gate green.
 */
export function forward(g: Genome, x: number[], hidden: number | number[] = NHID): ForwardResult {
	const layers = hiddenLayers(hidden);
	let prev: number[] = x;
	let prevN = inputCount(g, hidden);
	let p = 0;
	const h: number[][] = [];
	for (const L of layers) {
		const wStart = p;
		p += L * prevN;
		const bStart = p;
		p += L;
		const cur = new Array<number>(L);
		for (let j = 0; j < L; j++) {
			let s = 0;
			for (let i = 0; i < prevN; i++) s += g[wStart + j * prevN + i] * (prev[i] ?? 0);
			cur[j] = Math.tanh(s + g[bStart + j]);
		}
		h.push(cur);
		prev = cur;
		prevN = L;
	}
	const wStart = p;
	p += NOUT * prevN;
	const bStart = p;
	const o = new Array<number>(NOUT);
	for (let k = 0; k < NOUT; k++) {
		let s = 0;
		for (let j = 0; j < prevN; j++) s += g[wStart + k * prevN + j] * prev[j];
		o[k] = s + g[bStart + k];
	}
	const turn = Math.tanh(o[0]);
	const thrust = 1 / (1 + Math.exp(-o[1]));
	return { turn, thrust, h, o: [turn, thrust] };
}

/**
 * The weight from unit `from` of one layer into unit `to` of the next, for the brain viz — walking
 * the flat genome with the full layer shape. `sizes` is [nin, ...hidden, nout]; `layer` indexes the
 * transition (0 = inputs→first hidden). Neuron-major within a layer, weights then biases, as `forward`
 * lays them out.
 */
export function edgeWeight(
	g: Genome,
	sizes: number[],
	layer: number,
	from: number,
	to: number
): number {
	let p = 0;
	for (let l = 0; l < layer; l++) p += sizes[l + 1] * sizes[l] + sizes[l + 1]; // skip earlier layers
	return g[p + to * sizes[layer] + from];
}
