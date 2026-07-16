/**
 * The brain visualization — the REAL weight matrix, not decoration.
 * Faithful port of engine2.js `drawBrain`.
 *
 * Renders the selected fish's actual genome as an 8→6→2 node graph:
 *   edge colour = sign (excite = +, inhibit = −) — see ThemePalette for why these are their
 *     own colours rather than the theme's accent/danger pair
 *   edge thickness = |weight|
 *   travelling pulse brightness = live signal (|weight × activation|)
 * A sense that is off dims its input node and feeds 0, so no signal flows from it.
 */

import {
	TAU,
	NIN,
	NHID,
	inputCount,
	NOUT,
	IN_LABELS,
	IN_SENSE,
	OUT_LABELS,
	weightIH,
	weightHO
} from '../engine';
import type { Senses, SenseSnapshot } from '../engine';
import { THEMES, type ThemeName } from './theme';

export interface DrawBrainOpts {
	/** Which senses are enabled — an off sense dims its input node and feeds 0. */
	senses: Senses;
	/** Live snapshot of the selected fish's mind; null renders the resting net. */
	sense: SenseSnapshot | null;
	/** World clock, drives the travelling signal pulses. */
	t: number;
	theme: ThemeName;
	reducedMotion?: boolean;
}

// The resting net's activations — all zero, shared and never written, so painting a fish-less
// brain 60×/s doesn't allocate two arrays a frame.
const SILENT_INPUTS: readonly number[] = new Array<number>(NIN).fill(0);
const SILENT_HIDDEN: readonly number[] = new Array<number>(NHID).fill(0);

export function drawBrain(
	ctx: CanvasRenderingContext2D,
	W: number,
	H: number,
	{ senses: S, sense, t, theme, reducedMotion = false }: DrawBrainOpts
): void {
	const th = THEMES[theme];
	const accent = th.excite;
	const danger = th.inhibit;
	const rm = reducedMotion;
	ctx.clearRect(0, 0, W, H);

	// dotted backdrop
	ctx.fillStyle = theme === 'light' ? 'rgba(29,34,48,.05)' : 'rgba(255,255,255,.05)';
	for (let gx = 12; gx < W; gx += 18) {
		for (let gy = 12; gy < H; gy += 18) {
			ctx.beginPath();
			ctx.arc(gx, gy, 0.8, 0, TAU);
			ctx.fill();
		}
	}

	const x = sense ? sense.x : SILENT_INPUTS;
	const h = sense ? sense.h : SILENT_HIDDEN;
	const g = sense ? sense.genome : null;
	// The brain is as wide/deep as THIS world's brains are — the hidden count is the length of the
	// live activation array (or NHID for the resting net), and the input count follows from it. Never
	// a module constant: 6-, and bigger-hidden brains coexist on one bench.
	const nhid = h.length;
	const nin = g ? inputCount(g, nhid) : x.length;
	const turn = sense ? sense.turn : 0;
	const thrust = sense ? sense.thrust : 0;

	const IX = 66;
	const HX = W / 2;
	const OX = W - 60;
	const iy = (i: number) => 20 + (i * (H - 34)) / (nin - 1);
	const hy = (j: number) => 40 + (j * (H - 70)) / Math.max(1, nhid - 1);
	const oy = (k: number) => H * 0.38 + k * H * 0.26;
	const senseOn = (idx: number): boolean => {
		const key = IN_SENSE[idx];
		return key === null ? true : !!S[key];
	};

	const edge = (
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		wgt: number,
		act: number,
		seed: number
	) => {
		const on = Math.abs(wgt) > 0.001;
		const pos = wgt >= 0;
		const signal = Math.abs(wgt * act);
		ctx.strokeStyle = pos ? accent : danger;
		ctx.globalAlpha = on ? Math.min(0.85, 0.06 + signal * 0.9) : 0.04;
		ctx.lineWidth = Math.min(2.6, 0.3 + Math.abs(wgt) * 1.1);
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
		if (signal > 0.08 && !rm) {
			const k = (t * 0.5 + seed * 0.097) % 1;
			ctx.globalAlpha = Math.min(1, signal * 1.4);
			ctx.fillStyle = pos ? accent : danger;
			ctx.beginPath();
			ctx.arc(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 1.4 + Math.min(2, signal * 2), 0, TAU);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	};

	if (g) {
		for (let i = 0; i < nin; i++) {
			for (let j = 0; j < nhid; j++)
				edge(IX, iy(i), HX, hy(j), weightIH(g, j, i, nhid), x[i], i * nhid + j);
		}
		for (let j = 0; j < nhid; j++) {
			for (let k = 0; k < NOUT; k++)
				edge(HX, hy(j), OX, oy(k), weightHO(g, k, j, nhid), h[j], 40 + j * NOUT + k);
		}
	}

	const node = (cx: number, cy: number, act: number, on: boolean, r = 6) => {
		const a = Math.abs(act);
		if (on && a > 0.05) {
			const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 7);
			rg.addColorStop(0, act < 0 ? danger : accent);
			rg.addColorStop(1, 'rgba(0,0,0,0)');
			ctx.globalAlpha = a * 0.5;
			ctx.fillStyle = rg;
			ctx.beginPath();
			ctx.arc(cx, cy, r + 7, 0, TAU);
			ctx.fill();
			ctx.globalAlpha = 1;
		}
		ctx.fillStyle = theme === 'light' ? '#fff' : '#1a1a22';
		ctx.strokeStyle = on ? (act < 0 ? danger : accent) : th.inkSoft;
		ctx.globalAlpha = on ? 1 : 0.4;
		ctx.lineWidth = 1.4;
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, TAU);
		ctx.fill();
		ctx.stroke();
		if (on) {
			ctx.fillStyle = act < 0 ? danger : accent;
			ctx.globalAlpha = 0.2 + a * 0.8;
			ctx.beginPath();
			ctx.arc(cx, cy, r * 0.5, 0, TAU);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	};

	ctx.font = '500 9px Inter, sans-serif';
	for (let i = 0; i < nin; i++) {
		const on = senseOn(i);
		node(IX, iy(i), x[i], on, 5);
		ctx.fillStyle = on ? th.ink : th.inkSoft;
		ctx.globalAlpha = on ? 0.85 : 0.4;
		ctx.textAlign = 'right';
		ctx.fillText(IN_LABELS[i] + (on ? '' : ' · off'), IX - 10, iy(i) + 3);
		ctx.globalAlpha = 1;
	}
	for (let j = 0; j < nhid; j++) node(HX, hy(j), h[j], true, 6);

	ctx.textAlign = 'left';
	const outs = [turn, thrust];
	for (let k = 0; k < NOUT; k++) {
		node(OX, oy(k), outs[k], true, 7);
		ctx.fillStyle = th.ink;
		ctx.globalAlpha = 0.85;
		ctx.fillText(OUT_LABELS[k], OX + 11, oy(k) + 3);
		ctx.globalAlpha = 1;
	}

	ctx.textAlign = 'center';
	ctx.fillStyle = th.inkSoft;
	ctx.globalAlpha = 0.55;
	ctx.font = '500 8.5px Inter, sans-serif';
	ctx.fillText('inputs', IX, H - 5);
	ctx.fillText('hidden', HX, H - 5);
	ctx.fillText('outputs', OX, H - 5);
	ctx.globalAlpha = 1;
	ctx.textAlign = 'left';
}
