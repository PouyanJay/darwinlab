/**
 * The Atlas heatmap — a survival landscape painted under a pan/zoom camera.
 *
 * Each grid cell is a filled square, coral where fish die fast, teal where they last, brightness
 * riding the same scale so the terrain reads at a glance. The camera (tx, ty, scale) is applied by
 * hand so the picker/hover math in the component and the paint here agree on exactly one mapping
 * from grid coordinates to the screen. The one annotation is the measured cliff, traced row by row:
 * each row's steepest fall-off cell wears a gold dashed outline, so the edge reads as terrain.
 *
 * Pure: it reads a LandscapeField and a few numbers, touches no store and no DOM beyond the 2D
 * context. Colours are data, not chrome, so the coral→teal ramp is the same in both themes; only the
 * grid lines, empty cells and label ink follow the theme for contrast.
 */

import type { LandscapeField, Falloff } from '../lab/landscape';

type Rgb = [number, number, number];
// The survival ramp's ends, for the canvas. ⚠️ MIRROR of --data-coral / --data-teal in
// styles/tokens.css — the DOM (verdict, effect bars, legends) reads those tokens and the canvas paints
// from these triples, so they must stay the same two colours or a legend lies about the map beside it.
/** Short survival — the cliff. */
const CORAL: Rgb = [232, 96, 76];
/** Long survival — the ridge. */
const TEAL: Rgb = [14, 148, 136];

/**
 * A point on the survival ramp — coral (t=0, short) → teal (t=1, long). The ONE survival palette the
 * whole platform speaks: the Atlas and the Sweep's run grid paint it on canvas from here; the DOM
 * (effect bars, legends, the verdict) reads the matching `--data-*` tokens. Returns a CSS `rgb(...)`.
 */
export function heatColor(t: number): string {
	return lerp(CORAL, TEAL, t);
}

interface Palette {
	/** An unmeasured cell. */
	empty: string;
	/** Cell outlines (hover, drill). */
	line: string;
	/** The gold cliff dashes — the measured fall-off, traced row by row. */
	cliff: string;
}

const PALETTES: Record<'light' | 'dark', Palette> = {
	light: { empty: 'rgba(0,0,0,0.05)', line: '#111318', cliff: 'rgba(216,161,58,0.9)' },
	dark: { empty: 'rgba(255,255,255,0.05)', line: '#e7e8ec', cliff: 'rgba(230,189,98,0.85)' }
};

/** Coordinates of a cell the map wants to outline (hover) or drill (select). */
export interface CellRef {
	ix: number;
	iy: number;
}

export interface LandscapePaint {
	field: LandscapeField;
	theme: 'light' | 'dark';
	hovered: CellRef | null;
	selected: CellRef | null;
	/** Each row's own steepest fall-off (null rows stay untraced) — the gold dashes. */
	cliffRows: (Falloff | null)[];
}

function lerp(a: Rgb, b: Rgb, t: number): string {
	const k = Math.max(0, Math.min(1, t));
	const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * k);
	return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

/**
 * Paint the landscape FILLING the canvas — the grid stretches to the full width × height, so cells
 * are rectangles that leave no dead margin (a small square grid lost in a black frame was the old
 * look). Grid coordinates map straight to pixels: a column is `width / cols` wide, a row
 * `height / rows` tall, which is also exactly how the component hit-tests a pointer back to a cell.
 */
export function drawLandscape(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	{ field, theme, hovered, selected, cliffRows }: LandscapePaint
): void {
	ctx.clearRect(0, 0, width, height);
	const palette = PALETTES[theme];
	const span = Math.max(1e-6, field.max - field.min);
	const cw = width / field.cols;
	const ch = height / field.rows;

	// Row iy=0 is the Y axis's MINIMUM, drawn at the BOTTOM — the map reads like a chart (Y grows
	// upward), and the component's hit-test uses the same flip. One mapping, used everywhere here.
	const rowTop = (iy: number) => (field.rows - 1 - iy) * ch;

	// A hairline gap between cells reads as a grid without a separate stroke pass.
	const gap = 0.75;
	for (let iy = 0; iy < field.rows; iy++) {
		for (let ix = 0; ix < field.cols; ix++) {
			const value = field.values[iy * field.cols + ix];
			ctx.fillStyle = Number.isFinite(value)
				? lerp(CORAL, TEAL, (value - field.min) / span)
				: palette.empty;
			ctx.fillRect(ix * cw + gap, rowTop(iy) + gap, cw - 2 * gap, ch - 2 * gap);
		}
	}

	// The measured cliff, traced ROW BY ROW: each row's steepest fall-off cell wears a gold dashed
	// outline, so the edge reads as terrain (it can bend) rather than one straight line. A row with
	// no positive drop stays untraced — a flat or rising row gets no fake cliff drawn on it.
	ctx.save();
	ctx.strokeStyle = palette.cliff;
	ctx.lineWidth = 1.5;
	ctx.setLineDash([4, 3]);
	cliffRows.forEach((cliff, iy) => {
		if (!cliff) return;
		ctx.strokeRect(
			cliff.ix * cw + gap + 1,
			rowTop(iy) + gap + 1,
			cw - 2 * gap - 2,
			ch - 2 * gap - 2
		);
	});
	ctx.restore();

	// Outline the hovered cell, and the drilled one more firmly, so the pointer has a target.
	const outline = (ref: CellRef, weight: number) => {
		ctx.save();
		ctx.strokeStyle = palette.line;
		ctx.lineWidth = weight;
		ctx.strokeRect(ref.ix * cw + gap, rowTop(ref.iy) + gap, cw - 2 * gap, ch - 2 * gap);
		ctx.restore();
	};
	if (hovered) outline(hovered, 1.5);
	if (selected) outline(selected, 2.5);
}
