import { describe, it, expect, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Canvas from './Canvas.svelte';

/** Wait for the ResizeObserver / attachment to have run at least one paint. */
const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

describe('Canvas', () => {
	it('paints in CSS pixels with a DPR-scaled backing store', async () => {
		const seen: { w: number; h: number; transform: DOMMatrix }[] = [];
		const paint = vi.fn((ctx: CanvasRenderingContext2D, w: number, h: number) => {
			seen.push({ w, h, transform: ctx.getTransform() });
		});

		const { container } = render(Canvas, { paint, label: 'test canvas' });
		await settle();

		const canvas = container.querySelector('canvas')!;
		expect(paint).toHaveBeenCalled();

		const { w, h } = seen[seen.length - 1];
		expect(w).toBe(canvas.clientWidth); // paint receives CSS pixels, not device pixels
		expect(h).toBe(canvas.clientHeight);

		// the bitmap is scaled up by DPR (capped at 2), and the ctx is pre-scaled to match
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		expect(canvas.width).toBe(Math.round(canvas.clientWidth * dpr));
		expect(canvas.height).toBe(Math.round(canvas.clientHeight * dpr));
		expect(seen[seen.length - 1].transform.a).toBeCloseTo(dpr, 5);
	});

	it('repaints when an external driver calls its render fn', async () => {
		const paint = vi.fn();
		let drive: (() => void) | undefined;
		const register = (render: () => void) => {
			drive = render;
			return () => {};
		};

		render(Canvas, { paint, register, label: 'driven' });
		await settle();

		const before = paint.mock.calls.length;
		drive!();
		drive!();
		expect(paint.mock.calls.length).toBe(before + 2);
	});

	it('unregisters its painter when destroyed (no leak into the loop)', async () => {
		const unregister = vi.fn();
		const register = vi.fn(() => unregister);

		const { unmount } = render(Canvas, { paint: () => {}, register, label: 'driven' });
		await settle();
		expect(register).toHaveBeenCalledTimes(1);

		unmount();
		expect(unregister).toHaveBeenCalledTimes(1);
	});

	it('reports pointer coordinates in the same space it paints in', async () => {
		const onpick = vi.fn();
		const onhover = vi.fn();
		const onleave = vi.fn();

		const { container } = render(Canvas, {
			paint: () => {},
			onpick,
			onhover,
			onleave,
			label: 'pickable'
		});
		await settle();
		const canvas = container.querySelector('canvas')!;

		canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
		canvas.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

		expect(onpick).toHaveBeenCalledTimes(1);
		expect(onhover).toHaveBeenCalledTimes(1);
		expect(onleave).toHaveBeenCalledTimes(1);
		// offsetX/offsetY are numbers in CSS-pixel space
		expect(typeof onpick.mock.calls[0][0]).toBe('number');
	});

	it('exposes an accessible label (meaning is never canvas-only)', async () => {
		const { container } = render(Canvas, { paint: () => {}, label: 'Direction tank' });
		await settle();
		const canvas = container.querySelector('canvas')!;
		expect(canvas.getAttribute('role')).toBe('img');
		expect(canvas.getAttribute('aria-label')).toBe('Direction tank');
	});
});
