import { describe, it, expect } from 'vitest';
import { Viewport } from './viewport.svelte';

/**
 * The camera math the lineage tree and the Atlas both ride on. Runes-backed, so this runs in the
 * client project; the assertions are pure geometry — pan adds, zoom keeps the cursor point fixed and
 * clamps, and fit centres.
 */

describe('Viewport', () => {
	it('panBy shifts the camera by a screen delta', () => {
		const view = new Viewport();
		view.panBy(30, -12);
		view.panBy(5, 2);
		expect(view.tx).toBe(35);
		expect(view.ty).toBe(-10);
	});

	it('toCanvas inverts the transform', () => {
		const view = new Viewport();
		view.tx = 40;
		view.ty = 20;
		view.scale = 2;
		// screen = canvas * scale + t, so canvas = (screen - t) / scale
		expect(view.toCanvas(140, 120)).toEqual({ x: 50, y: 50 });
	});

	it('zoomAt keeps whatever is under the cursor fixed', () => {
		const view = new Viewport({ minScale: 0.1, maxScale: 8 });
		const before = view.toCanvas(100, 100);
		view.zoomAt(100, 100, 2);
		expect(view.scale).toBeCloseTo(2);
		// the canvas point under (100,100) is unchanged — the whole point of zoom-toward-cursor
		expect(view.toCanvas(100, 100).x).toBeCloseTo(before.x);
		expect(view.toCanvas(100, 100).y).toBeCloseTo(before.y);
	});

	it('clamps to the upper bound and does not drift the pan once pinned', () => {
		const view = new Viewport({ minScale: 0.5, maxScale: 2 });
		view.zoomAt(100, 100, 10); // asks for 10×, clamps to 2×
		expect(view.scale).toBe(2);
		const { tx, ty } = view;
		view.zoomAt(100, 100, 10); // already at the max — must not move the pan for nothing
		expect(view.tx).toBe(tx);
		expect(view.ty).toBe(ty);
	});

	it('clamps to the lower bound too', () => {
		const view = new Viewport({ minScale: 0.5, maxScale: 2 });
		view.zoomAt(100, 100, 0.01); // asks to zoom far out, clamps to the 0.5 floor
		expect(view.scale).toBe(0.5);
	});

	it('fitBox centres a box and scales it to fit the viewport', () => {
		const view = new Viewport({ minScale: 0.1, maxScale: 8 });
		// a 100×100 box into a 300×300 viewport with no padding → scale 3, centred at the origin
		view.fitBox(0, 0, 100, 100, 300, 300, 0);
		expect(view.scale).toBeCloseTo(3);
		// the box centre (50,50) lands at the viewport centre (150,150)
		const centre = { x: view.tx + 50 * view.scale, y: view.ty + 50 * view.scale };
		expect(centre.x).toBeCloseTo(150);
		expect(centre.y).toBeCloseTo(150);
	});

	it('fitBox is limited by the tighter axis, not the looser one', () => {
		const view = new Viewport({ minScale: 0.1, maxScale: 8 });
		// a WIDE box (200×50) into a square 400×400 viewport: width limits at 400/200 = 2, not 400/50 = 8
		view.fitBox(0, 0, 200, 50, 400, 400, 0);
		expect(view.scale).toBeCloseTo(2);
		// still centred: the box centre (100,25) lands at the viewport centre (200,200)
		expect(view.tx + 100 * view.scale).toBeCloseTo(200);
		expect(view.ty + 25 * view.scale).toBeCloseTo(200);
	});

	it('reset returns to the origin at 1:1', () => {
		const view = new Viewport();
		view.panBy(50, 50);
		view.scale = 1.4;
		view.reset();
		expect(view).toMatchObject({ tx: 0, ty: 0, scale: 1 });
	});
});
