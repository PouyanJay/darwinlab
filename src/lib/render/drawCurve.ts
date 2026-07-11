/**
 * The two charts. Faithful port of engine2.js `drawCurve` / `drawDecay`.
 *
 * - drawCurve: the learning curve — survival % across generations (training).
 * - drawDecay: the real-world run — fraction of the deployed batch still alive over time.
 *
 * The learning curve's y-axis is deliberately zoomed to the [0.1, 0.9] band so the real trend
 * reads through the noise of a small stochastic population.
 */

import { TAU, clamp, CURVE_LO, CURVE_HI } from '../engine';
import { THEMES, type ThemeName } from './theme';

/** Learning curve: survival rate across generations. */
export function drawCurve(
	ctx: CanvasRenderingContext2D,
	W: number,
	H: number,
	curve: number[],
	accent: string,
	theme: ThemeName
): void {
	ctx.clearRect(0, 0, W, H);
	const th = THEMES[theme];
	ctx.strokeStyle = th.inkSoft;
	ctx.globalAlpha = 0.18;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(1, H - 1);
	ctx.lineTo(W - 1, H - 1);
	ctx.stroke();
	ctx.globalAlpha = 1;
	if (!curve || curve.length === 0) return;

	const pts = curve.length > 1 ? curve : [curve[0], curve[0]];
	const map = (v: number) => H - 2 - clamp((v - CURVE_LO) / (CURVE_HI - CURVE_LO), 0, 1) * (H - 4);
	ctx.beginPath();
	pts.forEach((v, i) => {
		const px = (i / (pts.length - 1)) * (W - 2) + 1;
		const py = map(v);
		if (i) ctx.lineTo(px, py);
		else ctx.moveTo(px, py);
	});
	ctx.strokeStyle = accent;
	ctx.lineWidth = 1.6;
	ctx.lineJoin = 'round';
	ctx.stroke();
	ctx.lineTo(W - 1, H - 1);
	ctx.lineTo(1, H - 1);
	ctx.closePath();
	ctx.globalAlpha = 0.13;
	ctx.fillStyle = accent;
	ctx.fill();
	ctx.globalAlpha = 1;
	const last = pts[pts.length - 1];
	ctx.fillStyle = accent;
	ctx.beginPath();
	ctx.arc(W - 2, map(last), 2, 0, TAU);
	ctx.fill();
}

/** Real-world population decay: fraction of the deployed batch still alive, over time. */
export function drawDecay(
	ctx: CanvasRenderingContext2D,
	W: number,
	H: number,
	decay: number[],
	theme: ThemeName
): void {
	ctx.clearRect(0, 0, W, H);
	const th = THEMES[theme];
	ctx.strokeStyle = th.inkSoft;
	ctx.globalAlpha = 0.16;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(1, H - 1);
	ctx.lineTo(W - 1, H - 1);
	ctx.stroke();
	ctx.globalAlpha = 1;
	if (!decay || decay.length === 0) return;

	const pts = decay.length > 1 ? decay : [decay[0], decay[0]];
	const col = th.threat;
	const map = (v: number) => H - 2 - clamp(v, 0, 1) * (H - 4);
	ctx.beginPath();
	pts.forEach((v, i) => {
		const px = (i / (pts.length - 1)) * (W - 2) + 1;
		const py = map(v);
		if (i) ctx.lineTo(px, py);
		else ctx.moveTo(px, py);
	});
	ctx.strokeStyle = col;
	ctx.lineWidth = 1.6;
	ctx.lineJoin = 'round';
	ctx.stroke();
	ctx.lineTo(W - 1, H - 1);
	ctx.lineTo(1, H - 1);
	ctx.closePath();
	ctx.globalAlpha = 0.12;
	ctx.fillStyle = col;
	ctx.fill();
	ctx.globalAlpha = 1;
	const last = pts[pts.length - 1];
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.arc(W - 2, map(last), 2, 0, TAU);
	ctx.fill();
}
