/**
 * The Atlas heatmap — a survival landscape painted under a pan/zoom camera.
 *
 * Each grid cell is a filled square, coral where fish die fast, teal where they last, brightness
 * riding the same scale so the terrain reads at a glance. The camera (tx, ty, scale) is applied by
 * hand so the picker/hover math in the component and the paint here agree on exactly one mapping
 * from grid coordinates to the screen. The one annotation is the measured cliff: a dashed line down
 * the column boundary where survival falls off hardest.
 *
 * Pure: it reads a LandscapeField and a few numbers, touches no store and no DOM beyond the 2D
 * context. Colours are data, not chrome, so the coral→teal ramp is the same in both themes; only the
 * grid lines, empty cells and label ink follow the theme for contrast.
 */

import type { LandscapeField, Falloff } from '../lab/landscape';

/** Canvas-space size of one cell, before the camera scales it. Shared with the component's hit-testing. */
export const CELL = 56;

type Rgb = [number, number, number];
/** Short survival — the cliff. */
const CORAL: Rgb = [232, 96, 76];
/** Long survival — the ridge. */
const TEAL: Rgb = [14, 148, 136];

/** The ramp's ends as CSS strings — the single source of truth the Legend's gradient reuses. */
export const HEAT_LOW = `rgb(${CORAL[0]}, ${CORAL[1]}, ${CORAL[2]})`;
export const HEAT_HIGH = `rgb(${TEAL[0]}, ${TEAL[1]}, ${TEAL[2]})`;

interface Palette {
	/** An unmeasured cell. */
	empty: string;
	/** The cliff line and cell outlines. */
	line: string;
}

const PALETTES: Record<'light' | 'dark', Palette> = {
	light: { empty: 'rgba(0,0,0,0.05)', line: '#111318' },
	dark: { empty: 'rgba(255,255,255,0.05)', line: '#e7e8ec' }
};

/** Coordinates of a cell the map wants to outline (hover) or drill (select). */
export interface CellRef {
	ix: number;
	iy: number;
}

export interface LandscapePaint {
	field: LandscapeField;
	tx: number;
	ty: number;
	scale: number;
	theme: 'light' | 'dark';
	hovered: CellRef | null;
	selected: CellRef | null;
	falloff: Falloff | null;
}

function lerp(a: Rgb, b: Rgb, t: number): string {
	const k = Math.max(0, Math.min(1, t));
	const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * k);
	return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

export function drawLandscape(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	{ field, tx, ty, scale, theme, hovered, selected, falloff }: LandscapePaint
): void {
	ctx.clearRect(0, 0, width, height);
	const palette = PALETTES[theme];
	const span = Math.max(1e-6, field.max - field.min);
	const size = CELL * scale;

	// Grid coordinate → top-left in screen pixels.
	const sx = (ix: number) => tx + ix * size;
	const sy = (iy: number) => ty + iy * size;

	// The cells. A hairline gap between them reads as a grid without a separate stroke pass.
	const gap = Math.min(1, size * 0.06);
	for (let iy = 0; iy < field.rows; iy++) {
		for (let ix = 0; ix < field.cols; ix++) {
			const value = field.values[iy * field.cols + ix];
			ctx.fillStyle = Number.isFinite(value)
				? lerp(CORAL, TEAL, (value - field.min) / span)
				: palette.empty;
			ctx.fillRect(sx(ix) + gap, sy(iy) + gap, size - 2 * gap, size - 2 * gap);
		}
	}

	// The measured cliff: a dashed line down the column boundary where survival falls off hardest.
	if (falloff) {
		const x = sx(falloff.ix + 1);
		ctx.save();
		ctx.strokeStyle = palette.line;
		ctx.lineWidth = 1.5;
		ctx.setLineDash([5, 5]);
		ctx.beginPath();
		ctx.moveTo(x, sy(0));
		ctx.lineTo(x, sy(field.rows));
		ctx.stroke();
		ctx.restore();
	}

	// Outline the hovered cell, and the drilled one more firmly, so the pointer has a target.
	const outline = (ref: CellRef, weight: number) => {
		ctx.save();
		ctx.strokeStyle = palette.line;
		ctx.lineWidth = weight;
		ctx.strokeRect(sx(ref.ix) + gap, sy(ref.iy) + gap, size - 2 * gap, size - 2 * gap);
		ctx.restore();
	};
	if (hovered) outline(hovered, 1.5);
	if (selected) outline(selected, 2.5);
}
