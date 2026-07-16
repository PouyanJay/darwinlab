/**
 * The lineage canvas VIEWPORT — one pan/zoom transform for the whole plane.
 *
 * This is pure view state: how the camera sits over the tree, nothing about the worlds themselves.
 * Node positions live per-world on `entry.lineage` (views.svelte.ts); this holds only the shared
 * `translate(tx, ty) scale(scale)` that maps canvas coordinates onto the screen. Screen = canvas *
 * scale + (tx, ty).
 *
 * Kept out of the bench store on purpose — the bench is the seam that mutates the SIM, and moving
 * the camera touches no genome, fitness, or curve.
 */

import { clampScale } from '../lab/lineage';

class LineageCanvasStore {
	/** The pan offset, in screen pixels. */
	tx = $state(0);
	ty = $state(0);
	/** The zoom factor (1 = canvas units are screen pixels). */
	scale = $state(1);

	/** Drag empty space: shift the camera by a screen-space delta. */
	panBy(dx: number, dy: number): void {
		this.tx += dx;
		this.ty += dy;
	}

	/**
	 * Zoom toward a screen point (the cursor), keeping whatever is under it fixed — the behaviour a
	 * scroll-to-zoom canvas is expected to have. `px`/`py` are relative to the canvas container's
	 * top-left; `factor` multiplies the current scale before clamping.
	 */
	zoomAt(px: number, py: number, factor: number): void {
		const next = clampScale(this.scale * factor);
		const k = next / this.scale;
		if (k === 1) return; // already at a bound — don't drift the pan for nothing
		this.tx = px - k * (px - this.tx);
		this.ty = py - k * (py - this.ty);
		this.scale = next;
	}

	/** Convert a screen point (relative to the container) into canvas coordinates. */
	toCanvas(px: number, py: number): { x: number; y: number } {
		return { x: (px - this.tx) / this.scale, y: (py - this.ty) / this.scale };
	}

	/**
	 * Frame a canvas-space bounding box in a viewport of the given screen size — the "recenter"
	 * action. Picks the largest scale (within bounds) that fits the box with padding, then centres it.
	 */
	fitBox(
		minX: number,
		minY: number,
		maxX: number,
		maxY: number,
		viewW: number,
		viewH: number,
		pad = 90
	): void {
		const bw = Math.max(1, maxX - minX);
		const bh = Math.max(1, maxY - minY);
		const s = clampScale(Math.min((viewW - pad * 2) / bw, (viewH - pad * 2) / bh));
		this.scale = s;
		this.tx = (viewW - bw * s) / 2 - minX * s;
		this.ty = (viewH - bh * s) / 2 - minY * s;
	}

	/** Put a canvas point at the centre of the viewport, at a given scale — used to open focused on one
	 *  node when the whole tree is too big to frame legibly (a phone). */
	centerOn(cx: number, cy: number, viewW: number, viewH: number, scale: number): void {
		this.scale = clampScale(scale);
		this.tx = viewW / 2 - cx * this.scale;
		this.ty = viewH / 2 - cy * this.scale;
	}

	/** Back to origin, 1:1 — used when a fresh bench is loaded and there is nothing to frame yet. */
	reset(): void {
		this.tx = 0;
		this.ty = 0;
		this.scale = 1;
	}
}

export const canvas = new LineageCanvasStore();
