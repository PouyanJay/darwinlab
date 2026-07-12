<!--
  A DPR-aware canvas host.

  Owns the two things every canvas in this app needs and nothing else:
   1. Backing-store sizing — the bitmap is sized to CSS pixels × devicePixelRatio (capped at 2,
      beyond which the cost outweighs the sharpness), and re-sized via ResizeObserver so the
      tank stays crisp across window resizes and monitor changes. The context is pre-scaled, so
      `paint` always draws in CSS pixels and never has to think about DPR.
   2. Driving — pass `register` (e.g. `bench.painters.add`) and the sim loop repaints this canvas
      every frame. Omit it and the canvas only repaints on resize, which is what static charts want.

  Painting is invoked directly, NOT through reactivity: the world data it reads is deliberately
  unreactive (see state/bench.svelte.ts) because proxying it at frame rate would be ruinous.
-->
<script lang="ts">
	/** Cap DPR at 2 — past this the extra pixels cost more than they show. */
	const MAX_DPR = 2;

	interface Props {
		/** Draw one frame. `ctx` is already scaled, so draw in CSS pixels. */
		paint: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
		/** Opt into external driving (the sim loop). Returns its unregister fn. */
		register?: (render: () => void) => () => void;
		/** Pointer position in CSS pixels — the same space `paint` draws in, so picking lines up. */
		onpick?: (x: number, y: number) => void;
		onhover?: (x: number, y: number) => void;
		onleave?: () => void;
		/**
		 * Keyboard support (the tank's creature cycler). Present, the canvas joins the tab order
		 * as an application widget; absent (the charts), it stays a plain graphic.
		 */
		onkeydown?: (event: KeyboardEvent) => void;
		label: string;
		cursor?: string;
	}

	let {
		paint,
		register,
		onpick,
		onhover,
		onleave,
		onkeydown,
		label,
		cursor = 'default'
	}: Props = $props();

	const deviceScale = () => Math.min(MAX_DPR, window.devicePixelRatio || 1);

	/** Size the bitmap to the element's CSS box × DPR. Returns the CSS size we should paint in. */
	function sizeToDevice(canvas: HTMLCanvasElement): { width: number; height: number } {
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		if (!width || !height) return { width: 0, height: 0 }; // not laid out yet

		const scale = deviceScale();
		const bitmapWidth = Math.round(width * scale);
		const bitmapHeight = Math.round(height * scale);
		// only assign when it actually changes — writing width/height clears the canvas
		if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
			canvas.width = bitmapWidth;
			canvas.height = bitmapHeight;
		}
		return { width, height };
	}

	function host(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			console.error(`Canvas: no 2D context available for "${label}" — nothing will render.`);
			return;
		}

		const render = () => {
			const { width, height } = sizeToDevice(canvas);
			if (!width || !height) return;
			const scale = deviceScale();
			ctx.setTransform(scale, 0, 0, scale, 0, 0); // paint in CSS pixels
			paint(ctx, width, height);
		};

		render();
		const observer = new ResizeObserver(render);
		observer.observe(canvas);
		const unregister = register?.(render);

		return () => {
			observer.disconnect();
			unregister?.();
		};
	}
</script>

<!--
	Two kinds of canvas share this host. A chart is a GRAPHIC: role="img", not focusable, its
	state readable from `aria-label` (meaning is never pixels-only) — its click handler is a
	mouse shortcut to targets the keyboard reaches through real buttons (e.g. "★ Champion").
	A tank with a keyboard handler is a WIDGET: role="application" (so AT hands the arrow keys
	through to the creature cycler), focusable, operable without a pointer.
-->
<canvas
	{@attach host}
	role={onkeydown ? 'application' : 'img'}
	aria-label={label}
	tabindex={onkeydown ? 0 : undefined}
	style:cursor
	{onkeydown}
	onclick={(e) => onpick?.(e.offsetX, e.offsetY)}
	onmousemove={(e) => onhover?.(e.offsetX, e.offsetY)}
	onmouseleave={() => onleave?.()}
></canvas>

<style>
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: manipulation; /* a tap picks a creature — never wait out a double-tap zoom */
	}
</style>
