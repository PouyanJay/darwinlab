<!--
  The landscape itself — a pannable, zoomable heatmap of survival across two parameters.

  Drag to pan, scroll to zoom toward the cursor, hover for a cell's numbers, click (or Enter on a
  keyboard-moved cursor) to drill in. The camera is the Atlas's own `Viewport`; the paint runs
  through the shared DPR-aware Canvas host, driven not by the sim loop (idle in Research) but by an
  effect that repaints whenever the picture would change — the camera, the field, the cursor, or the
  theme. Grid coordinates map to the screen through exactly one transform, shared with the painter,
  so where you point is the cell you get.
-->
<script lang="ts">
	import Canvas from '../../common/Canvas.svelte';
	import Button from '../../common/Button.svelte';
	import Icon from '../../common/Icon.svelte';
	import { landscape, theme } from '$lib/state';
	import { drawLandscape, CELL, type CellRef } from '$lib/render';

	let container = $state<HTMLDivElement>();
	const view = landscape.view;

	/** The outlined cell — set by hover or by the keyboard cursor; the one Enter/click drills. */
	let focus = $state<CellRef | null>(null);
	/** Pointer position within the container, for placing the tooltip. */
	let pointer = $state<{ px: number; py: number } | null>(null);
	/** The host's repaint fn, captured so the effect below can drive it on state change. */
	let repaint = $state<(() => void) | undefined>();

	const register = (render: () => void) => {
		repaint = render;
		return () => (repaint = undefined);
	};

	function paint(ctx: CanvasRenderingContext2D, width: number, height: number): void {
		const field = landscape.field;
		if (!field) {
			ctx.clearRect(0, 0, width, height);
			return;
		}
		drawLandscape(ctx, width, height, {
			field,
			tx: view.tx,
			ty: view.ty,
			scale: view.scale,
			theme: theme.name,
			hovered: focus,
			selected: landscape.selected,
			falloff: landscape.falloff
		});
	}

	// Repaint whenever any input to the picture changes. This is the sync-to-canvas seam: the Research
	// stage has no per-frame loop, so the map is driven off its own reactive dependencies instead.
	$effect(() => {
		void (view.tx, view.ty, view.scale, landscape.field, landscape.selected, focus, theme.name);
		repaint?.();
	});

	/** Frame the whole grid in the viewport — on a new field, and on demand (recenter). */
	function frame(): void {
		const field = landscape.field;
		if (!field || !container) return;
		const rect = container.getBoundingClientRect();
		view.fitBox(0, 0, field.cols * CELL, field.rows * CELL, rect.width, rect.height, 24);
	}

	// A fresh field is a fresh landscape — frame it. Reads only `field`, so writing the camera here
	// cannot re-trigger it (no loop with the repaint effect, which never writes state).
	$effect(() => {
		if (landscape.field) frame();
	});

	// Wheel must be a NON-PASSIVE listener or preventDefault is ignored and the page scrolls instead.
	$effect(() => {
		const el = container;
		if (!el) return;
		const onwheel = (event: WheelEvent) => {
			event.preventDefault();
			const rect = el.getBoundingClientRect();
			view.zoomAt(
				event.clientX - rect.left,
				event.clientY - rect.top,
				Math.exp(-event.deltaY * 0.0015)
			);
		};
		el.addEventListener('wheel', onwheel, { passive: false });
		return () => el.removeEventListener('wheel', onwheel);
	});

	function localPos(event: PointerEvent): { px: number; py: number } {
		const rect = container!.getBoundingClientRect();
		return { px: event.clientX - rect.left, py: event.clientY - rect.top };
	}

	/** Which grid cell a container-relative point falls on, or null if outside the grid. */
	function cellAt(px: number, py: number): CellRef | null {
		const field = landscape.field;
		if (!field) return null;
		const { x, y } = view.toCanvas(px, py);
		const ix = Math.floor(x / CELL);
		const iy = Math.floor(y / CELL);
		if (ix < 0 || iy < 0 || ix >= field.cols || iy >= field.rows) return null;
		return { ix, iy };
	}

	// A press is a pan until it proves itself a click — a click that never moved drills the cell.
	let drag: { lastX: number; lastY: number; moved: boolean } | null = null;
	let grabbing = $state(false);

	function onpointerdown(event: PointerEvent): void {
		if (event.button !== 0 || !container) return;
		drag = { lastX: event.clientX, lastY: event.clientY, moved: false };
		grabbing = true;
		container.setPointerCapture(event.pointerId);
	}

	function onpointermove(event: PointerEvent): void {
		const { px, py } = localPos(event);
		pointer = { px, py };
		if (drag) {
			const dx = event.clientX - drag.lastX;
			const dy = event.clientY - drag.lastY;
			if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
			drag.lastX = event.clientX;
			drag.lastY = event.clientY;
			view.panBy(dx, dy);
			focus = null; // no cell outline while the plane is moving
		} else {
			focus = cellAt(px, py);
		}
	}

	function onpointerup(event: PointerEvent): void {
		if (drag && !drag.moved) {
			const { px, py } = localPos(event);
			const cell = cellAt(px, py);
			if (cell) landscape.select(cell.ix, cell.iy);
		}
		endDrag(event);
	}

	function endDrag(event: PointerEvent): void {
		drag = null;
		grabbing = false;
		if (container?.hasPointerCapture(event.pointerId))
			container.releasePointerCapture(event.pointerId);
	}

	function onpointerleave(): void {
		if (!drag) focus = null;
		pointer = null;
	}

	/** Arrow keys move a cursor cell; Enter/Space drills it — the keyboard path to the same drill-in. */
	function onkeydown(event: KeyboardEvent): void {
		const field = landscape.field;
		if (!field) return;
		const step: Record<string, [number, number]> = {
			ArrowRight: [1, 0],
			ArrowLeft: [-1, 0],
			ArrowDown: [0, 1],
			ArrowUp: [0, -1]
		};
		if (event.key in step) {
			const [dx, dy] = step[event.key];
			const base = focus ?? { ix: 0, iy: 0 };
			focus = {
				ix: Math.max(0, Math.min(field.cols - 1, base.ix + dx)),
				iy: Math.max(0, Math.min(field.rows - 1, base.iy + dy))
			};
			event.preventDefault();
		} else if ((event.key === 'Enter' || event.key === ' ') && focus) {
			landscape.select(focus.ix, focus.iy);
			event.preventDefault();
		}
	}

	function zoomFromCentre(factor: number): void {
		if (!container) return;
		const rect = container.getBoundingClientRect();
		view.zoomAt(rect.width / 2, rect.height / 2, factor);
	}

	/**
	 * The focused cell's labels, axis values and survival — the tooltip's contents, matching the drill
	 * card. Everything reads the FIELD's own frozen axes, so touching the picker before the next run
	 * never relabels the painted grid with an axis it was not measured on.
	 */
	const focusValues = $derived.by(() => {
		const field = landscape.field;
		if (!field || !focus) return null;
		const xs = field.axisX;
		const ys = field.axisY;
		// The grid is uniform, so a cell's axis value is recoverable from its index without the plan.
		const x = xs.min + ((xs.max - xs.min) * focus.ix) / Math.max(1, field.cols - 1);
		const y = ys.min + ((ys.max - ys.min) * focus.iy) / Math.max(1, field.rows - 1);
		const value = field.values[focus.iy * field.cols + focus.ix];
		return { xLabel: xs.label, yLabel: ys.label, x: xs.format(x), y: ys.format(y), value };
	});

	const mapLabel = $derived.by(() => {
		const field = landscape.field;
		if (!field) return 'Survival landscape — run the Atlas to fill it.';
		const grid = `${field.cols} by ${field.rows} grid of ${field.axisX.label} against ${field.axisY.label}`;
		return `Survival landscape, ${grid}. Drag to pan, scroll to zoom, arrow keys to move the cursor, Enter to open a cell.`;
	});
</script>

<!-- The wrapper carries the POINTER gestures (pan + hover + click-to-drill) as a role="group",
     exactly like the lineage canvas; the KEYBOARD widget (arrow-cursor + Enter-to-drill) lives on
     the <canvas> itself, where the Canvas host gives it role="application" and focus. Splitting them
     this way keeps each element's a11y semantics honest — no non-interactive div holding key handlers. -->
<div
	class="map"
	class:grabbing
	bind:this={container}
	role="group"
	aria-label="Survival landscape map — drag to pan, scroll to zoom"
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	onpointercancel={endDrag}
	{onpointerleave}
>
	<Canvas {paint} {register} {onkeydown} label={mapLabel} cursor={grabbing ? 'grabbing' : 'grab'} />

	{#if focusValues && pointer && !grabbing}
		<div class="tip" style:left="{pointer.px}px" style:top="{pointer.py}px" aria-hidden="true">
			<span class="tip-line tabular">{focusValues.xLabel} {focusValues.x}</span>
			<span class="tip-line tabular">{focusValues.yLabel} {focusValues.y}</span>
			<span class="tip-val tabular"
				>{Number.isFinite(focusValues.value) ? `${focusValues.value.toFixed(1)}s` : '—'}</span
			>
		</div>
	{/if}

	<div class="controls">
		<Button variant="icon" size="sm" aria-label="zoom out" onclick={() => zoomFromCentre(1 / 1.2)}>
			<Icon name="minus" size={15} />
		</Button>
		<span class="zoom tabular" aria-hidden="true">{Math.round(view.scale * 100)}%</span>
		<Button variant="icon" size="sm" aria-label="zoom in" onclick={() => zoomFromCentre(1.2)}>
			<Icon name="plus" size={15} />
		</Button>
		<Button variant="icon" size="sm" aria-label="recenter the landscape" onclick={frame}>
			<Icon name="crosshair" size={15} />
		</Button>
	</div>
</div>

<style>
	.map {
		position: relative;
		width: 100%;
		height: clamp(320px, 46vh, 520px);
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--canvas-bg);
		cursor: grab;
		touch-action: none;
	}

	.map.grabbing {
		cursor: grabbing;
	}

	/* The focusable element is the <canvas> inside (the keyboard widget), so the focus ring lands there. */
	.map :global(canvas:focus-visible) {
		outline: var(--focus-ring);
		outline-offset: -2px;
	}

	.tip {
		position: absolute;
		z-index: 3;
		transform: translate(12px, 12px);
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 6px 9px;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--glass);
		backdrop-filter: blur(var(--blur-glass));
		box-shadow: var(--shadow-pill);
		pointer-events: none;
		white-space: nowrap;
	}

	.tip-line {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
		font-variant-numeric: tabular-nums;
	}

	.tip-val {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.controls {
		position: absolute;
		right: var(--sp-4);
		bottom: var(--sp-4);
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 4px var(--sp-2);
		border: 1px solid var(--line);
		border-radius: var(--radius-pill);
		background: var(--glass);
		backdrop-filter: blur(var(--blur-glass));
		box-shadow: var(--shadow-pill);
	}

	.zoom {
		min-width: 40px;
		padding: 0 4px;
		text-align: center;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--ink2);
		font-variant-numeric: tabular-nums;
	}
</style>
