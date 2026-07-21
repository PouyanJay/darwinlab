/**
 * A pan/zoom CAMERA over a plane — one `translate(tx, ty) scale(scale)` transform, nothing else.
 *
 * This is pure view state: how the camera sits over a scene, never anything about the scene itself.
 * Screen = canvas * scale + (tx, ty); `toCanvas` inverts it. Two surfaces share this exact behaviour
 * — the lineage tree (worlds as draggable nodes) and the Atlas (a survival landscape you pan) — so
 * the transform math lives here once and each surface owns its OWN instance. They must never share a
 * camera: panning the tree must not move the Atlas.
 *
 * Scale bounds default to the lineage tree's, so the bench camera behaves exactly as before; a
 * surface that wants to zoom further (the Atlas, drilling into a cliff) passes its own.
 */

import { MIN_SCALE, MAX_SCALE, CANVAS_PAD } from '../lab/lineage';

export interface ViewportBounds {
	minScale: number;
	maxScale: number;
}

export class Viewport {
	/** The pan offset, in screen pixels. */
	tx = $state(0);
	ty = $state(0);
	/** The zoom factor (1 = canvas units are screen pixels). */
	scale = $state(1);

	#minScale: number;
	#maxScale: number;

	constructor(bounds: Partial<ViewportBounds> = {}) {
		this.#minScale = bounds.minScale ?? MIN_SCALE;
		this.#maxScale = bounds.maxScale ?? MAX_SCALE;
	}

	#clamp(scale: number): number {
		return Math.min(this.#maxScale, Math.max(this.#minScale, scale));
	}

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
		const next = this.#clamp(this.scale * factor);
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
		pad = CANVAS_PAD
	): void {
		const bw = Math.max(1, maxX - minX);
		const bh = Math.max(1, maxY - minY);
		const s = this.#clamp(Math.min((viewW - pad * 2) / bw, (viewH - pad * 2) / bh));
		this.scale = s;
		this.tx = (viewW - bw * s) / 2 - minX * s;
		this.ty = (viewH - bh * s) / 2 - minY * s;
	}

	/** Back to origin, 1:1 — used when a fresh scene is loaded and there is nothing to frame yet. */
	reset(): void {
		this.tx = 0;
		this.ty = 0;
		this.scale = 1;
	}
}
