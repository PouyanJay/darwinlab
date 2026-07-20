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
	theme: ThemeName
): void {
	drawSparkline(ctx, W, H, curve, theme, {
		color: accent,
		map: (v) => H - 2 - clamp((v - CURVE_LO) / (CURVE_HI - CURVE_LO), 0, 1) * (H - 4),
		baselineAlpha: 0.18,
		fillAlpha: 0.13
	});
}

/**
 * The emergence curve: mean nearest-neighbour distance per generation, drawn as TIGHTNESS so the
 * line RISES as a school forms (consistent with the learning curve, where up is the good direction).
 * A loose population sits near the floor; a tight bait-ball climbs toward the top.
 */
const SCHOOL_TIGHT = 20; // px — a genuinely packed ball
const SCHOOL_LOOSE = 120; // px — scattered across the tank
export function drawSchoolCurve(
	ctx: CanvasRenderingContext2D,
	W: number,
	H: number,
	curve: number[],
	accent: string,
	theme: ThemeName
): void {
	drawSparkline(ctx, W, H, curve, theme, {
		color: accent,
		map: (nnd) =>
			H - 2 - clamp(1 - (nnd - SCHOOL_TIGHT) / (SCHOOL_LOOSE - SCHOOL_TIGHT), 0, 1) * (H - 4),
		baselineAlpha: 0.18,
		fillAlpha: 0.13
	});
}

/**
 * The learning curve on a TRUE 0–1 axis — for charts that print an axis (the workbench's metric
 * cards say 1.0 / 0.5 / 0.0), where the sparkline's legibility zoom would make the labels lie:
 * zoomed, a 1% survival rate clamps flat onto the floor and reads as a broken, empty chart.
 * The tile sparklines keep the zoomed drawCurve — they carry no axis, so the zoom misleads nobody.
 */
export function drawRate(
	ctx: CanvasRenderingContext2D,
	W: number,
	H: number,
	curve: number[],
	accent: string,
	theme: ThemeName
): void {
	drawSparkline(ctx, W, H, curve, theme, {
		color: accent,
		map: (v) => H - 2 - clamp(v, 0, 1) * (H - 4),
		baselineAlpha: 0.18,
		fillAlpha: 0.13
	});
}

/** Real-world population decay: fraction of the deployed batch still alive, over time.
 *  In the WORLD'S accent, like every other chart on the card — the accent owns the graphs. */
export function drawDecay(
	ctx: CanvasRenderingContext2D,
	W: number,
	H: number,
	decay: number[],
	accent: string,
	theme: ThemeName
): void {
	drawSparkline(ctx, W, H, decay, theme, {
		color: accent,
		map: (v) => H - 2 - clamp(v, 0, 1) * (H - 4),
		baselineAlpha: 0.16,
		fillAlpha: 0.12
	});
}
