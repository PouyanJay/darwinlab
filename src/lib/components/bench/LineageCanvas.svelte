<!--
  The lineage canvas - the bench as a family tree instead of a grid.

  Every world is a draggable node on an infinite, pannable, zoomable plane. Drag empty space to pan,
  scroll to zoom (toward the cursor), and drag a node by its header to move it. Branching a world
  drops a child below it, wired to its parent by a live curved edge - so the screen becomes the shape
  of the experiment: what was changed from what, and which line of reasoning it belongs to.

  The camera (pan + zoom) lives in the `canvas` store; each node's position lives on its own
  `entry.lineage`. This component only reads those and routes pointer gestures back through the store
  (`moveWorld`) and the viewport (`panBy` / `zoomAt` / `fitBox`) - it never mutates a world.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import WorldTile from './WorldTile.svelte';
	import Button from '../common/Button.svelte';
	import Icon from '../common/Icon.svelte';
	import type { WorldEntry } from '$lib/state';
	import { bench, canvas, prefersReducedMotion, shell } from '$lib/state';
	import { NODE_W, ESTIMATED_NODE_H, edgePath } from '$lib/lab/lineage';

	interface Props {
		/** Add a fresh root world - the canvas offers it in its own corner, not only the sidebar. */
		onaddworld: () => void;
		/**
		 * Handed the canvas's "fit the tree" action on mount (the same `register` pattern Canvas uses).
		 * On a phone the canvas hides its own zoom cluster - pinch handles zoom - so the recenter rides
		 * in the transport pill instead, which calls back through this. The parent only offers it to the
		 * pill while this canvas is the live view, so a handle to a torn-down canvas is never reached.
		 */
		onrecenterready?: (recenter: () => void) => void;
	}

	let { onaddworld, onrecenterready }: Props = $props();

	// Hand our recenter up to the parent once mounted (recenterTree is a hoisted declaration below).
	onMount(() => onrecenterready?.(recenterTree));

	let container: HTMLDivElement;
	/** Each node's rendered height, measured live - the edges need it to leave from a parent's foot. */
	let heights = $state<Record<string, number>>({});

	/** What a press is currently dragging: the whole plane, or one node by its handle. */
	type Drag = { kind: 'pan' | 'node'; id?: string; lastX: number; lastY: number };
	let drag: Drag | null = null;
	/** Drives the grabbing cursor - reactive so the class survives Svelte's unused-selector pruning. */
	let grabbing = $state(false);

	/**
	 * Every pointer currently down on the plane, keyed by pointerId. One entry drives a pan or a node
	 * drag; two entries are a PINCH - the plane zooms and single-pointer dragging is suspended until a
	 * finger lifts. `touch-action: none` on the container hands us the raw touch stream, so we own the
	 * pinch instead of the browser zooming the whole page. A plain object, not $state: like `drag`, this
	 * is transient gesture bookkeeping the template never reads.
	 */
	const points: Record<number, { x: number; y: number }> = {};
	const pointerCount = () => Object.keys(points).length;
	/** The finger span at the previous pinch frame, so a move can zoom by the ratio of the two. */
	let pinchSpan = 0;

	/** Straight-line distance between the two live pinch pointers. */
	function pinchDistance(): number {
		const [a, b] = Object.values(points);
		return Math.hypot(a.x - b.x, a.y - b.y);
	}
	/** Midpoint of the two pinch pointers, in screen coords - the point the zoom holds fixed. */
	function pinchMidpoint(): { x: number; y: number } {
		const [a, b] = Object.values(points);
		return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	}

	// A press that lands on any of these is that control's to handle, never the start of a drag.
	const INTERACTIVE =
		'button, a, input, textarea, select, summary, [role="button"], [contenteditable], .no-drag';

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0) return; // left button / primary touch only; right-click is the browser's
		points[event.pointerId] = { x: event.clientX, y: event.clientY };

		// A second finger turns whatever was happening into a pinch: abandon any pan/node drag, record
		// the opening span, and let the moves below zoom the plane about the point between the fingers.
		if (pointerCount() === 2) {
			drag = null;
			grabbing = false;
			pinchSpan = pinchDistance();
			container.setPointerCapture(event.pointerId);
			event.preventDefault();
			return;
		}

		const target = event.target as HTMLElement;
		const nodeEl = target.closest('[data-node]') as HTMLElement | null;
		const interactive = target.closest(INTERACTIVE);
		const onHandle = !!target.closest('[data-drag-handle]') && !interactive;

		if (nodeEl && onHandle) {
			drag = { kind: 'node', id: nodeEl.dataset.node, lastX: event.clientX, lastY: event.clientY };
		} else if (interactive) {
			return; // a button/input - the floating controls, add-world, or a node's own actions
		} else if (!nodeEl) {
			drag = { kind: 'pan', lastX: event.clientX, lastY: event.clientY }; // empty plane
		} else {
			return; // inside a node but not on its handle - let the tank have the press
		}
		container.setPointerCapture(event.pointerId);
		grabbing = true;
		event.preventDefault();
	}

	function onpointermove(event: PointerEvent) {
		if (event.pointerId in points) {
			points[event.pointerId] = { x: event.clientX, y: event.clientY };
		}

		// Two fingers down: zoom by how much the span grew or shrank since the last frame, holding the
		// midpoint fixed. Pan and node-drag stay suspended until we are back to a single pointer.
		if (pointerCount() >= 2) {
			const span = pinchDistance();
			if (pinchSpan > 0 && span > 0) {
				const mid = pinchMidpoint();
				const rect = container.getBoundingClientRect();
				canvas.zoomAt(mid.x - rect.left, mid.y - rect.top, span / pinchSpan);
			}
			pinchSpan = span;
			return;
		}

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
		delete points[event.pointerId];
		// Back below two fingers ends the pinch. The finger left behind does NOT resume panning - that
		// would jump the plane - it simply waits until it, too, lifts.
		if (pointerCount() < 2) pinchSpan = 0;
		if (container.hasPointerCapture(event.pointerId)) {
			container.releasePointerCapture(event.pointerId);
		}
		if (!drag) return;
		drag = null;
		grabbing = false;
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

	/** The tree's bounding box in canvas coordinates - each node's footprint, measured or estimated. */
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

	/**
	 * The vertical room a framed world gets. On a phone the transport pill floats over the bottom of the
	 * canvas, so we frame into the space from the top of the canvas to the TOP OF THE PILL - measured
	 * live, so the world ends up centred with EQUAL margins top and bottom whatever the device's
	 * safe-area does to the pill's height. Off the phone (no floating pill) it is the whole canvas.
	 */
	function availableHeight(rect: DOMRect): number {
		if (!shell.narrow) return rect.height;
		const pill = document.querySelector('aside.rail')?.getBoundingClientRect();
		return pill && pill.top > rect.top ? pill.top - rect.top : rect.height;
	}

	/** Frame the whole tree in the viewport - the "recenter" action. */
	function recenterTree() {
		const rect = container.getBoundingClientRect();
		if (!bench.worlds.length) {
			canvas.reset();
			return;
		}
		const { minX, minY, maxX, maxY } = treeBounds(bench.worlds);
		canvas.fitBox(minX, minY, maxX, maxY, rect.width, availableHeight(rect));
	}

	// Wheel must be a NON-PASSIVE listener or preventDefault is ignored and the page scrolls instead
	// of the canvas zooming.
	$effect(() => {
		const el = container;
		el.addEventListener('wheel', onwheel, { passive: false });
		return () => el.removeEventListener('wheel', onwheel);
	});

	/** A small inset so the first node isn't jammed against the canvas edge on open. */
	const MARGIN = 28;

	/**
	 * The opening frame. It opens at 100% (1:1) - the default the owner asked for - with the tree
	 * CENTRED in the canvas, so the worlds sit in the middle of the screen at full, readable size and
	 * the rest is a pan (or a recenter) away. A phone too narrow for a whole node at 1:1 backs off
	 * just enough to fit the node's width; everything wider opens at exactly 100%. Deliberately NOT
	 * re-run on every add/branch - the camera stays where the user left it; recenter re-frames.
	 */
	function frameInitial() {
		const rect = container.getBoundingClientRect();
		if (!bench.worlds.length) {
			canvas.reset();
			return;
		}
		// On a phone, OPEN framed on a single world - readable, centred, and clear of the pill - which
		// reads as a clean default; the rest of the tree is a pan away. (Centring the whole tree only
		// lands on a clean node by luck - it breaks the moment the tree is a different shape or size.)
		// Desktop keeps the whole-tree overview.
		const { minX, minY, maxX, maxY } = shell.narrow
			? treeBounds([bench.worlds[0]])
			: treeBounds(bench.worlds);
		const s = Math.min(1, (rect.width - 2 * MARGIN) / NODE_W); // 1 on anything but a narrow phone
		canvas.scale = s;
		// Equal margins: centre horizontally in the canvas, and vertically in the space above the pill -
		// so the world sits dead-centre of what you can actually see, not tucked up or under the pill.
		canvas.tx = (rect.width - (maxX - minX) * s) / 2 - minX * s;
		canvas.ty = (availableHeight(rect) - (maxY - minY) * s) / 2 - minY * s;
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
	aria-label="lineage canvas - worlds as draggable nodes; drag to pan, scroll or pinch to zoom"
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
		<Button variant="icon" size="sm" aria-label="recenter the tree" onclick={recenterTree}>
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
		/* FULL BLEED: no border, no radius - the plane runs to the edges of the bench, not a card
		   sitting on a layer. A plain, flat surface - pure black in dark. */
		background: var(--canvas-bg);
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

	/* A node's body is not draggable (only its header is) and not grab-cursored - the tank and its
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
		/* the wire stays the same weight at every zoom - it is a relationship, not an object in the water */
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

	/* The same pill as "Add environment" across the way - one family of floating canvas controls. */
	.controls {
		right: var(--sp-4);
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

	/* Phone: the floating canvas controls stand down. The transport pill (SidebarRail) already carries
	   an "add environment" button and now a recenter button, and pinch handles zoom in/out - so both the
	   Add pill and the whole zoom cluster (which the owner found ate too much space) are hidden here. */
	@media (max-width: 900px) {
		.add,
		.controls {
			display: none;
		}
	}
</style>
