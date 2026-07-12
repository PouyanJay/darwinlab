/**
 * Wrap a canvas painter so it repaints only when its picture would actually change.
 *
 * The sim loop repaints every registered canvas every frame, but a sparkline only gains a point
 * at a generation boundary — repainting it 60×/s is pure waste. The caller's `signature` must
 * cover everything the pixels are built from (the data, the colours); the wrapper itself covers
 * the canvas bitmap, because resizing a canvas ERASES it — skip a repaint after a resize and the
 * chart would simply be gone.
 */
type Paint = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

export function paintOnChange(signature: () => string, paint: Paint): Paint {
	let last: string | null = null;
	return (ctx, width, height) => {
		const next = `${ctx.canvas.width}x${ctx.canvas.height}|${width}x${height}|${signature()}`;
		if (next === last) return;
		last = next;
		paint(ctx, width, height);
	};
}
