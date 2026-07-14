/**
 * The two charts. Faithful port of engine2.js `drawCurve` / `drawDecay`.
 *
 * - drawCurve: the learning curve — survival % across generations (training).
 * - drawDecay: the real-world run — fraction of the deployed batch still alive over time.
 *
 * Both are the same sparkline (baseline, line, area fill, head dot) and differ only in the
 * value→y mapping and the colour, so they share one painter.
 *
 * The learning curve's y-axis is deliberately zoomed to the [0.1, 0.9] band so the real trend
 * reads through the noise of a small stochastic population.
 */

import { TAU, clamp, CURVE_LO, CURVE_HI } from '../engine';
import { THEMES, type ThemeName } from './theme';

interface SparklineStyle {
	color: string;
	/** value (0–1) → y pixel. */
	map: (v: number) => number;
	baselineAlpha: number;
	fillAlpha: number;
}

function drawSparkline(
	ctx: CanvasRenderingContext2D,
	W: number,
	H: number,
	series: number[],
	theme: ThemeName,
	{ color, map, baselineAlpha, fillAlpha }: SparklineStyle
): void {
	ctx.clearRect(0, 0, W, H);

	// baseline
	ctx.strokeStyle = THEMES[theme].inkSoft;
	ctx.globalAlpha = baselineAlpha;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(1, H - 1);
	ctx.lineTo(W - 1, H - 1);
	ctx.stroke();
	ctx.globalAlpha = 1;
	if (!series || series.length === 0) return;

	// a single point still needs two vertices to draw a line
	const pts = series.length > 1 ? series : [series[0], series[0]];
	ctx.beginPath();
	pts.forEach((v, i) => {
		const px = (i / (pts.length - 1)) * (W - 2) + 1;
		const py = map(v);
		if (i) ctx.lineTo(px, py);
		else ctx.moveTo(px, py);
	});
	ctx.strokeStyle = color;
	ctx.lineWidth = 1.6;
	ctx.lineJoin = 'round';
	ctx.stroke();

	// close the path down to the baseline and fill the area
	ctx.lineTo(W - 1, H - 1);
	ctx.lineTo(1, H - 1);
	ctx.closePath();
	ctx.globalAlpha = fillAlpha;
	ctx.fillStyle = color;
	ctx.fill();
	ctx.globalAlpha = 1;

	// head dot
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(W - 2, map(pts[pts.length - 1]), 2, 0, TAU);
	ctx.fill();
}

/** Learning curve: survival rate across generations, zoomed to the legible [0.1, 0.9] band. */
export function drawCurve(
	ctx: CanvasRenderingContext2D,
	W: number,
	H: number,
	curve: number[],
	accent: string,
	theme: ThemeName,
	/**
	 * Where the run was deliberately INTERVENED IN — today, a clonal bottleneck — as INDICES into
	 * `curve`, not as generation numbers.
	 *
	 * Indices, because the series scrolls: it shift()s once it passes CURVE_MAX_POINTS, so generation
	 * 40 is not point 40 for long. Resolving a generation to a point needs to know which generation
	 * the series now starts at, and only the caller knows that. A painter that guessed would draw the
	 * mark in the wrong place — which is worse than not drawing it, because a mark in the wrong place
	 * is a claim about a generation that did not have one.
	 *
	 * They are marked at all because a curve that drops off a cliff and does not say why is exactly
	 * the kind of chart this product exists to argue against.
	 */
	marks: number[] = []
): void {
	drawSparkline(ctx, W, H, curve, theme, {
		color: accent,
		map: (v) => H - 2 - clamp((v - CURVE_LO) / (CURVE_HI - CURVE_LO), 0, 1) * (H - 4),
		baselineAlpha: 0.18,
		fillAlpha: 0.13
	});

	if (!marks.length || curve.length < 2) return;

	// A dashed gold rule where the population was replaced by hand. Gold, because that is the
	// champion's colour, and a bottleneck is the moment the champion became everybody.
	ctx.save();
	ctx.strokeStyle = THEMES[theme].gold;
	ctx.lineWidth = 1;
	ctx.setLineDash([2, 2]);
	for (const index of marks) {
		if (index < 0 || index >= curve.length) continue; // scrolled off the left edge — say nothing
		const x = 1 + (index / (curve.length - 1)) * (W - 2);
		ctx.beginPath();
		ctx.moveTo(x, 1);
		ctx.lineTo(x, H - 1);
		ctx.stroke();
	}
	ctx.restore();
}

/** Real-world population decay: fraction of the deployed batch still alive, over time. */
export function drawDecay(
	ctx: CanvasRenderingContext2D,
	W: number,
	H: number,
	decay: number[],
	theme: ThemeName
): void {
	drawSparkline(ctx, W, H, decay, theme, {
		color: THEMES[theme].threat,
		map: (v) => H - 2 - clamp(v, 0, 1) * (H - 4),
		baselineAlpha: 0.16,
		fillAlpha: 0.12
	});
}
