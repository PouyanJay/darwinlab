<!--
  The lineage canvas — the bench as a family tree instead of a grid.

  Every world is a draggable node on an infinite, pannable, zoomable plane. Drag empty space to pan,
  scroll to zoom (toward the cursor), and drag a node by its header to move it. Branching a world
  drops a child below it, wired to its parent by a live curved edge — so the screen becomes the shape
  of the experiment: what was changed from what, and which line of reasoning it belongs to.

  The camera (pan + zoom) lives in the `canvas` store; each node's position lives on its own
  `entry.lineage`. This component only reads those and routes pointer gestures back through the store
  (`moveWorld`) and the viewport (`panBy` / `zoomAt` / `fitBox`) — it never mutates a world.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import WorldTile from './WorldTile.svelte';
	import Button from '../common/Button.svelte';
	import Icon from '../common/Icon.svelte';
	import type { WorldEntry } from '$lib/state';
	import { bench, canvas, prefersReducedMotion } from '$lib/state';
	import { NODE_W, ESTIMATED_NODE_H, CANVAS_PAD, edgePath } from '$lib/lab/lineage';

	interface Props {
		/** Add a fresh root world — the canvas offers it in its own corner, not only the sidebar. */
		onaddworld: () => void;
	}

	let { onaddworld }: Props = $props();

	let container: HTMLDivElement;
	/** Each node's rendered height, measured live — the edges need it to leave from a parent's foot. */
	let heights = $state<Record<string, number>>({});

	/** What a press is currently dragging: the whole plane, or one node by its handle. */
	type Drag = { kind: 'pan' | 'node'; id?: string; lastX: number; lastY: number };
	let drag: Drag | null = null;
	/** Drives the grabbing cursor — reactive so the class survives Svelte's unused-selector pruning. */
	let grabbing = $state(false);

	// A press that lands on any of these is that control's to handle, never the start of a drag.
	const INTERACTIVE =
		'button, a, input, textarea, select, summary, [role="button"], [contenteditable], .no-drag';

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0) return; // left button only; right-click is the browser's
		const target = event.target as HTMLElement;
		const nodeEl = target.closest('[data-node]') as HTMLElement | null;
		const interactive = target.closest(INTERACTIVE);
		const onHandle = !!target.closest('[data-drag-handle]') && !interactive;

		if (nodeEl && onHandle) {
			drag = { kind: 'node', id: nodeEl.dataset.node, lastX: event.clientX, lastY: event.clientY };
		} else if (interactive) {
			return; // a button/input — the floating controls, add-world, or a node's own actions
		} else if (!nodeEl) {
			drag = { kind: 'pan', lastX: event.clientX, lastY: event.clientY }; // empty plane
		} else {
			return; // inside a node but not on its handle — let the tank have the press
		}
		container.setPointerCapture(event.pointerId);
		grabbing = true;
		event.preventDefault();
	}

	function onpointermove(event: PointerEvent) {
		if (!drag) return;
		const dx = event.clientX - drag.lastX;
		const dy = event.clientY - drag.lastY;
		drag.lastX = event.clientX;
		drag.lastY = event.clientY;

		if (drag.kind === 'pan') {
			canvas.panBy(dx, dy);
		} else if (drag.id) {
			const entry = bench.find(drag.id);
			// screen delta → canvas delta is a division by the zoom, so a node keeps pace with the cursor
			if (entry) {
				bench.moveWorld(
					drag.id,
					entry.lineage.x + dx / canvas.scale,
					entry.lineage.y + dy / canvas.scale
				);
			}
		}
	}

	function endDrag(event: PointerEvent) {
		if (!drag) return;
		drag = null;
		grabbing = false;
		if (container.hasPointerCapture(event.pointerId))
			container.releasePointerCapture(event.pointerId);
	}

	function onwheel(event: WheelEvent) {
		event.preventDefault();
		const rect = container.getBoundingClientRect();
		// a gentle exponential so a trackpad flick and a mouse notch both feel proportional
		canvas.zoomAt(
			event.clientX - rect.left,
			event.clientY - rect.top,
			Math.exp(-event.deltaY * 0.0015)
		);
	}

	function zoomFromCentre(factor: number) {
		const rect = container.getBoundingClientRect();
		canvas.zoomAt(rect.width / 2, rect.height / 2, factor);
	}

	/** The tree's bounding box in canvas coordinates — each node's footprint, measured or estimated. */
	function treeBounds(worlds: WorldEntry[]) {
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const entry of worlds) {
			minX = Math.min(minX, entry.lineage.x);
			minY = Math.min(minY, entry.lineage.y);
			maxX = Math.max(maxX, entry.lineage.x + NODE_W);
			maxY = Math.max(maxY, entry.lineage.y + (heights[entry.id] ?? ESTIMATED_NODE_H));
		}
		return { minX, minY, maxX, maxY };
	}

	/** Frame the whole tree in the viewport — the "recenter" action. */
	function recenter() {
		const rect = container.getBoundingClientRect();
		if (!bench.worlds.length) {
			canvas.reset();
			return;
		}
		const { minX, minY, maxX, maxY } = treeBounds(bench.worlds);
		canvas.fitBox(minX, minY, maxX, maxY, rect.width, rect.height);
	}

	// Wheel must be a NON-PASSIVE listener or preventDefault is ignored and the page scrolls instead
	// of the canvas zooming.
	$effect(() => {
		const el = container;
		el.addEventListener('wheel', onwheel, { passive: false });
		return () => el.removeEventListener('wheel', onwheel);
	});

	/**
	 * The opening frame, once the nodes have measured their heights. On a roomy screen it frames the
	 * whole tree (recenter). On a phone, fitting five nodes into 375px shrinks each to an unreadable,
	 * untappable sliver — so below a legible scale it instead opens focused on the first node, and the
	 * rest is a pan away. Deliberately NOT re-run on every add/branch: the camera stays where the user
	 * left it, and the recenter button is how they re-frame.
	 */
	function frameInitial() {
		const rect = container.getBoundingClientRect();
		if (!bench.worlds.length) {
			canvas.reset();
			return;
		}
		const { minX, minY, maxX, maxY } = treeBounds(bench.worlds);
		const fit = Math.min(
			(rect.width - 2 * CANVAS_PAD) / (maxX - minX || 1),
			(rect.height - 2 * CANVAS_PAD) / (maxY - minY || 1)
		);
		// 0.18 is the phone/desktop divide: a laptop frames five roots at ~0.3 and gets the whole tree;
		// only a genuinely tiny viewport (a phone at ~0.07) drops below it and opens focused on one node.
		if (fit >= 0.18) {
			canvas.fitBox(minX, minY, maxX, maxY, rect.width, rect.height);
		} else {
			const first = bench.worlds[0];
			canvas.centerOn(
				first.lineage.x + NODE_W / 2,
				first.lineage.y + (heights[first.id] ?? ESTIMATED_NODE_H) / 2,
				rect.width,
				rect.height,
				Math.min(0.85, (rect.width - 40) / NODE_W)
			);
		}
	}

	onMount(() => {
		requestAnimationFrame(() => requestAnimationFrame(frameInitial));
	});

	const reduced = $derived(prefersReducedMotion());

	/** The parent→child wires, in canvas coordinates: parent's foot to child's crown. */
	const edges = $derived(
		bench.worlds
			.filter((entry) => entry.lineage.parentId)
			.map((child) => {
				const parent = bench.find(child.lineage.parentId as string);
				if (!parent) return null;
				const x1 = parent.lineage.x + NODE_W / 2;
				const y1 = parent.lineage.y + (heights[parent.id] ?? 0);
				const x2 = child.lineage.x + NODE_W / 2;
				const y2 = child.lineage.y;
				return { id: child.id, d: edgePath(x1, y1, x2, y2) };
			})
			.filter((edge): edge is { id: string; d: string } => edge !== null)
	);
</script>

<div
	class="canvas"
	class:grabbing
	bind:this={container}
	role="group"
	aria-label="lineage canvas — worlds as draggable nodes; drag to pan, scroll to zoom"
	style:background-size="{18 * canvas.scale}px {18 * canvas.scale}px"
	style:background-position="{canvas.tx}px {canvas.ty}px"
	{onpointerdown}
	{onpointermove}
	onpointerup={endDrag}
	onpointercancel={endDrag}
>
	<div
		class="viewport"
		style:transform="translate({canvas.tx}px, {canvas.ty}px) scale({canvas.scale})"
	>
		<svg class="edges" class:still={reduced} aria-hidden="true">
			{#each edges as edge (edge.id)}
				<path d={edge.d} />
			{/each}
		</svg>

		{#each bench.worlds as entry, i (entry.id)}
			<div
				class="node"
				data-node={entry.id}
				style:left="{entry.lineage.x}px"
				style:top="{entry.lineage.y}px"
				style:width="{NODE_W}px"
				bind:clientHeight={heights[entry.id]}
			>
				<WorldTile {entry} index={i + 1} />
			</div>
		{/each}
	</div>

	<!-- Add a fresh root without opening the sidebar. -->
	<button class="add" onclick={onaddworld}>
		<Icon name="plus" size={15} />
		<span>Add environment</span>
	</button>

	<!-- The viewport controls, where a node editor always keeps them: a cluster in the low corner. -->
	<div class="controls">
		<Button variant="icon" size="sm" aria-label="zoom out" onclick={() => zoomFromCentre(1 / 1.2)}>
			<Icon name="minus" size={15} />
		</Button>
		<span class="zoom-readout tabular" aria-hidden="true">{Math.round(canvas.scale * 100)}%</span>
		<Button variant="icon" size="sm" aria-label="zoom in" onclick={() => zoomFromCentre(1.2)}>
			<Icon name="plus" size={15} />
		</Button>
		<Button variant="icon" size="sm" aria-label="recenter the tree" onclick={recenter}>
			<Icon name="crosshair" size={15} />
		</Button>
	</div>
</div>

<style>
	.canvas {
		position: relative;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background-color: var(--panel2);
		/* The infinite plane's ruled surface — dots that PAN and ZOOM with the camera, so a drag has
		   something to move against and the space reads as continuous rather than a static panel. */
		background-image: radial-gradient(circle, var(--line) 1.1px, transparent 1.1px);
		cursor: grab;
		touch-action: none;
	}

	.canvas.grabbing {
		cursor: grabbing;
	}

	.viewport {
		position: absolute;
		top: 0;
		left: 0;
		transform-origin: 0 0;
		will-change: transform;
	}

	/* A node's body is not draggable (only its header is) and not grab-cursored — the tank and its
	   controls keep their own affordances. */
	.node {
		position: absolute;
		cursor: default;
	}

	/* Zero-sized on purpose: the paths carry absolute canvas coordinates and draw past the box, so the
	   svg is only an origin, not a clip. */
	.edges {
		position: absolute;
		top: 0;
		left: 0;
		width: 1px;
		height: 1px;
		overflow: visible;
		pointer-events: none;
	}

	.edges path {
		fill: none;
		stroke: var(--ink3);
		stroke-width: 1.6;
		stroke-linecap: round;
		/* the wire stays the same weight at every zoom — it is a relationship, not an object in the water */
		vector-effect: non-scaling-stroke;
		stroke-dasharray: 5 6;
		animation: edge-flow 0.9s linear infinite;
	}

	/* Reduced motion: a still, solid wire says the same thing without the crawl. */
	.edges.still path {
		animation: none;
		stroke-dasharray: none;
	}

	@keyframes edge-flow {
		to {
			stroke-dashoffset: -22;
		}
	}

	.controls,
	.add {
		position: absolute;
		bottom: var(--sp-4);
		z-index: 2;
	}

	.controls {
		right: var(--sp-4);
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 3px;
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		background: var(--glass);
		backdrop-filter: blur(var(--blur-glass));
		box-shadow: var(--shadow-pill);
	}

	.zoom-readout {
		min-width: 40px;
		padding: 0 4px;
		text-align: center;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--ink2);
		font-variant-numeric: tabular-nums;
	}

	.add {
		left: var(--sp-4);
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding: var(--sp-2) var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-pill);
		background: var(--glass);
		backdrop-filter: blur(var(--blur-glass));
		box-shadow: var(--shadow-pill);
		color: var(--ink);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition:
			color var(--dur) var(--ease),
			border-color var(--dur) var(--ease);
	}

	.add:hover {
		border-color: var(--accent);
	}
</style>
