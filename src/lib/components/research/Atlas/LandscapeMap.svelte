<!--
  The landscape — a survival heatmap that FILLS its frame, read like a chart of the whole plane.

  The grid stretches to the full width × height (rectangular cells, no dead margin), with the two
  parameters as real axes: predator speed and its partner ticked along the bottom and up the side.
  Hover a cell for its numbers, click (or Enter on a keyboard-moved cursor) to drill in. The measured
  cliff is drawn as a dashed line where survival falls off hardest, and the colour scale sits on the
  map so "coral = wiped, teal = survives" is right there. Coordinates map straight to pixels — a
  column is width/cols wide — which is exactly how a pointer is hit-tested back to a cell.
-->
<script lang="ts">
	import Canvas from '../../common/Canvas.svelte';
	import ChartTooltip from '../../common/ChartTooltip.svelte';
	import { ARROW_STEP } from '../gridCursor';
	import { landscape, theme } from '$lib/state';
	import { drawLandscape, type CellRef } from '$lib/render';

	let chart = $state<HTMLDivElement>();

	/** The outlined cell — set by hover or the keyboard cursor; the one Enter/click drills. */
	let focus = $state<CellRef | null>(null);
	/** Pointer position within the chart, for placing the tooltip. */
	let pointer = $state<{ x: number; y: number } | null>(null);
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
			theme: theme.name,
			hovered: focus,
			selected: landscape.selected,
			falloff: landscape.falloff
		});
	}

	// Research has no per-frame loop, so the map repaints off its own reactive dependencies. Reading each
	// here is what subscribes this effect to it; `void` marks them read-for-tracking only.
	$effect(() => {
		void landscape.field;
		void landscape.selected;
		void focus;
		void theme.name;
		repaint?.();
	});

	/** Which grid cell a chart-relative point falls on, or null if outside. */
	function cellAt(x: number, y: number): CellRef | null {
		const field = landscape.field;
		if (!field || !chart) return null;
		const ix = Math.floor(x / (chart.clientWidth / field.cols));
		const iy = Math.floor(y / (chart.clientHeight / field.rows));
		if (ix < 0 || iy < 0 || ix >= field.cols || iy >= field.rows) return null;
		return { ix, iy };
	}

	function onhover(x: number, y: number): void {
		pointer = { x, y };
		focus = cellAt(x, y);
	}

	function onpick(x: number, y: number): void {
		const cell = cellAt(x, y);
		if (cell) landscape.select(cell.ix, cell.iy);
	}

	/** Arrow keys move a cursor cell; Enter/Space drills it — the keyboard path to the same drill-in. */
	function onkeydown(event: KeyboardEvent): void {
		const field = landscape.field;
		if (!field) return;
		if (event.key in ARROW_STEP) {
			const [dx, dy] = ARROW_STEP[event.key];
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

	const field = $derived(landscape.field);

	/** Five evenly-spaced ticks across an axis, min→max, formatted by the axis itself. */
	function axisTicks(min: number, max: number, format: (v: number) => string) {
		return Array.from({ length: 5 }, (_, i) => {
			const frac = i / 4;
			return { frac, label: format(min + (max - min) * frac) };
		});
	}
	const xTicks = $derived(
		field ? axisTicks(field.axisX.min, field.axisX.max, field.axisX.format) : []
	);

	/** The focused cell's labels, axis values and survival — the tooltip's contents. */
	const focusValues = $derived.by(() => {
		if (!field || !focus) return null;
		const xs = field.axisX;
		const ys = field.axisY;
		const x = xs.min + ((xs.max - xs.min) * focus.ix) / Math.max(1, field.cols - 1);
		const y = ys.min + ((ys.max - ys.min) * focus.iy) / Math.max(1, field.rows - 1);
		const value = field.values[focus.iy * field.cols + focus.ix];
		return { xLabel: xs.label, yLabel: ys.label, x: xs.format(x), y: ys.format(y), value };
	});

	/** Where along the width the cliff line sits, as a percentage — for the on-map label. */
	const cliffPct = $derived(
		field && landscape.falloff ? ((landscape.falloff.ix + 1) / field.cols) * 100 : null
	);

	const mapLabel = $derived(
		field
			? `Survival landscape, ${field.cols} by ${field.rows} grid of ${field.axisX.label} against ${field.axisY.label}. Arrow keys move the cursor, Enter opens a cell.`
			: 'Survival landscape — run the Atlas to fill it.'
	);
</script>

{#if field}
	<div class="map">
		<div class="ylabel"><span>{field.axisY.label} →</span></div>

		<div class="chart" bind:this={chart}>
			<Canvas
				{paint}
				{register}
				{onkeydown}
				{onpick}
				{onhover}
				onleave={() => (focus = null)}
				label={mapLabel}
				cursor="crosshair"
			/>

			<!-- The colour scale, on the map where the eye already is. -->
			<div class="legend" data-testid="atlas-legend" aria-hidden="true">
				<span>{field.min.toFixed(1)}s</span>
				<span class="ramp"></span>
				<span>{field.max.toFixed(1)}s</span>
			</div>

			<!-- The measured cliff, named at the line. -->
			{#if cliffPct !== null && landscape.falloff}
				<span class="cliff-label" style:left="{cliffPct}%" aria-hidden="true">
					the cliff · {field.axisX.format(landscape.falloff.x)}
				</span>
			{/if}

			{#if focusValues && pointer}
				<ChartTooltip x={pointer.x} y={pointer.y}>
					<span class="tip-line tabular">{focusValues.xLabel} {focusValues.x}</span>
					<span class="tip-line tabular">{focusValues.yLabel} {focusValues.y}</span>
					<span class="tip-val tabular"
						>{Number.isFinite(focusValues.value) ? `${focusValues.value.toFixed(1)}s` : '—'}</span
					>
				</ChartTooltip>
			{/if}
		</div>

		<div class="xaxis">
			<div class="xticks" aria-hidden="true">
				{#each xTicks as tick (tick.frac)}
					<span class="tabular" style:left="{tick.frac * 100}%">{tick.label}</span>
				{/each}
			</div>
			<span class="xlabel">{field.axisX.label} →</span>
		</div>
	</div>
{/if}

<style>
	.map {
		display: grid;
		grid-template-columns: 20px minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr) auto;
		gap: var(--sp-2);
	}

	.ylabel {
		grid-column: 1;
		grid-row: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ylabel span {
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		font-size: var(--fs-eyebrow);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
		white-space: nowrap;
	}

	.chart {
		grid-column: 2;
		grid-row: 1;
		position: relative;
		height: clamp(300px, 44vh, 460px);
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--canvas-bg);
	}

	.chart :global(canvas:focus-visible) {
		outline: var(--focus-ring);
		outline-offset: -2px;
	}

	.legend {
		position: absolute;
		top: var(--sp-2);
		right: var(--sp-2);
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		padding: 3px var(--sp-2);
		border-radius: var(--radius-pill);
		background: var(--glass);
		backdrop-filter: blur(var(--blur-glass));
		font-size: var(--fs-eyebrow);
		color: var(--ink2);
		font-variant-numeric: tabular-nums;
		pointer-events: none;
	}

	.ramp {
		width: 64px;
		height: 6px;
		border-radius: 3px;
		background: linear-gradient(90deg, var(--data-coral), var(--data-teal));
	}

	.cliff-label {
		position: absolute;
		top: var(--sp-2);
		transform: translateX(-50%);
		padding: 2px 7px;
		border-radius: var(--radius-chip);
		background: var(--glass);
		backdrop-filter: blur(var(--blur-glass));
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		color: var(--ink);
		white-space: nowrap;
		pointer-events: none;
	}

	.tip-line {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.tip-val {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--ink);
	}

	.xaxis {
		grid-column: 2;
		grid-row: 2;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.xticks {
		position: relative;
		height: 14px;
	}

	.xticks span {
		position: absolute;
		transform: translateX(-50%);
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
		font-variant-numeric: tabular-nums;
	}

	/* Keep the end ticks from spilling past the frame edges. */
	.xticks span:first-child {
		transform: none;
	}

	.xticks span:last-child {
		transform: translateX(-100%);
	}

	.xlabel {
		align-self: center;
		font-size: var(--fs-eyebrow);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}
</style>
