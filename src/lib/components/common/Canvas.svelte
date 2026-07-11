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
		label: string;
		cursor?: string;
	}

	let { paint, register, onpick, onhover, onleave, label, cursor = 'default' }: Props = $props();

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
	The canvas is a GRAPHIC that also accepts pointer input. Screen readers get its live state
	from `aria-label` (meaning is never pixels-only); clicking is a mouse affordance, and
	keyboard/AT users reach the same targets through real buttons (e.g. "★ Champion") rather
	than by hit-testing pixels. Svelte's heuristic sees the click handler and objects to the
	non-interactive role, but role="img" is the correct semantic here.
	TODO(phase-9): full keyboard/focus pass — give the tank a focusable creature cycler.
-->
<!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
<canvas
	{@attach host}
	role="img"
	aria-label={label}
	style:cursor
	onclick={(e) => onpick?.(e.offsetX, e.offsetY)}
	onmousemove={(e) => onhover?.(e.offsetX, e.offsetY)}
	onmouseleave={() => onleave?.()}
></canvas>

<style>
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
