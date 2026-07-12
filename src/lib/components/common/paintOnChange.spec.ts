import { describe, it, expect, vi } from 'vitest';
import { paintOnChange } from './paintOnChange';

/** The wrapper only reads the bitmap dimensions off the context. */
function fakeCtx(bitmapWidth = 200, bitmapHeight = 60): CanvasRenderingContext2D {
	return { canvas: { width: bitmapWidth, height: bitmapHeight } } as CanvasRenderingContext2D;
}

describe('paintOnChange', () => {
	it('paints on the first call and skips while the signature holds', () => {
		const paint = vi.fn();
		const wrapped = paintOnChange(() => 'same', paint);
		const ctx = fakeCtx();

		wrapped(ctx, 100, 30);
		wrapped(ctx, 100, 30);
		wrapped(ctx, 100, 30);
		expect(paint).toHaveBeenCalledTimes(1);
	});

	it('repaints when the signature changes', () => {
		const paint = vi.fn();
		let points = 3;
		const wrapped = paintOnChange(() => `${points}`, paint);
		const ctx = fakeCtx();

		wrapped(ctx, 100, 30);
		points = 4; // a new generation landed on the curve
		wrapped(ctx, 100, 30);
		expect(paint).toHaveBeenCalledTimes(2);
	});

	it('repaints when the canvas bitmap changes — resizing a canvas erases it', () => {
		const paint = vi.fn();
		const wrapped = paintOnChange(() => 'same', paint);

		wrapped(fakeCtx(200, 60), 100, 30);
		// same CSS size, sharper bitmap (a DPR change) — the old pixels are gone either way
		wrapped(fakeCtx(400, 120), 100, 30);
		expect(paint).toHaveBeenCalledTimes(2);
	});

	it('repaints when the CSS size changes', () => {
		const paint = vi.fn();
		const wrapped = paintOnChange(() => 'same', paint);
		const ctx = fakeCtx();

		wrapped(ctx, 100, 30);
		wrapped(ctx, 150, 30);
		expect(paint).toHaveBeenCalledTimes(2);
	});
});
