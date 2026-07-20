<!--
  One metric, as its own little chart card — the unit the workbench's metrics grid is built from.

  Each card is a single series painted straight from engine data (the same curves the tile packs into
  one Evidence block, here given room of their own): a title, the current value, a 0–1 axis, and the
  line. Painted on change, not every frame — a per-generation curve only gains a point at a boundary.
-->
<script lang="ts">
	import Canvas from '../common/Canvas.svelte';
	import { paintOnChange } from '../common/paintOnChange';
	import { bench, theme } from '$lib/state';

	type DrawFn = (
		ctx: CanvasRenderingContext2D,
		w: number,
		h: number,
		series: number[],
		accent: string,
		theme: 'light' | 'dark'
	) => void;

	interface Props {
		title: string;
		/** The current readout shown top-right — already formatted (e.g. "24%", "30.0s"). */
		value: string;
		/** The series to plot, read live from the raw world (never a reactive copy). */
		series: () => number[];
		/** Which painter draws it — drawCurve / drawDecay / drawSchoolCurve. */
		draw: DrawFn;
		accent: string;
		label: string;
		/** Show a 0–1 axis (the curves are fractions); off for anything not on that scale. */
		axis?: boolean;
	}

	let { title, value, series, draw, accent, label, axis = true }: Props = $props();

	const register = (render: () => void) => bench.painters.add(render);

	const paint = paintOnChange(
		() => `${series().length}|${series().at(0)}|${series().at(-1)}|${accent}|${theme.name}`,
		(ctx, w, h) => draw(ctx, w, h, series(), accent, theme.name)
	);
</script>

<div class="metric" style:--metric-accent={accent}>
	<div class="head">
		<span class="title">{title}</span>
		<b class="val tabular">{value}</b>
	</div>
	<div class="plot">
		{#if axis}
			<div class="axis" aria-hidden="true"><span>1.0</span><span>0.5</span><span>0.0</span></div>
		{/if}
		<div class="chart">
			<Canvas {paint} {register} {label} />
		</div>
	</div>
</div>

<style>
	.metric {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-width: 0;
		padding: var(--sp-3) var(--sp-4) var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--sp-3);
	}

	.title {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.val {
		flex: none;
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
		/* the metric's accent, run toward the ink so it holds AA at this size */
		color: color-mix(in srgb, var(--metric-accent) 60%, var(--ink));
	}

	.plot {
		display: flex;
		gap: 6px;
		min-width: 0;
	}

	/* The 0–1 axis: three ticks, monospaced-narrow, so the eye has a scale for the line. */
	.axis {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		flex: none;
		font-size: 8px;
		font-variant-numeric: tabular-nums;
		color: var(--ink3);
		text-align: right;
	}

	.chart {
		flex: 1;
		min-width: 0;
		height: 42px;
	}
</style>
