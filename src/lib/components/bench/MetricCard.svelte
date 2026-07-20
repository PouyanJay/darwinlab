<!--
  One metric, as its own card — the unit the workbench's metrics grid is built from.

  Two shapes, one card so the grid stays even: a CHART (a series painted straight from engine data,
  with a 0–1 axis) when given a `series`, or a plain STAT (a big number) when not. Charts are painted
  on change, not every frame — a per-generation curve only gains a point at a boundary.
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
		/** The readout shown large (stat) or top-right (chart) — already formatted ("24%", "30.0s"). */
		value: string;
		accent: string;
		/** A dimmed suffix on a stat's number, e.g. the "/ 20" after "15". */
		sub?: string;
		/** A stat card when omitted; a chart card when given the series to plot. */
		series?: () => number[];
		draw?: DrawFn;
		label?: string;
		testid?: string;
	}

	let { title, value, accent, sub, series, draw, label, testid }: Props = $props();

	const register = (render: () => void) => bench.painters.add(render);

	const paint = paintOnChange(
		() =>
			series && draw
				? `${series().length}|${series().at(0)}|${series().at(-1)}|${accent}|${theme.name}`
				: '',
		(ctx, w, h) => {
			if (series && draw) draw(ctx, w, h, series(), accent, theme.name);
		}
	);
</script>

<div class="metric" style:--metric-accent={accent}>
	<span class="title">{title}</span>
	{#if series && draw}
		<b class="val tabular" data-testid={testid}>{value}</b>
		<div class="plot">
			<div class="axis" aria-hidden="true"><span>1.0</span><span>0.5</span><span>0.0</span></div>
			<div class="chart"><Canvas {paint} {register} label={label ?? title} /></div>
		</div>
	{:else}
		<b class="big tabular" data-testid={testid}
			>{value}{#if sub}<span class="dim"> {sub}</span>{/if}</b
		>
	{/if}
</div>

<style>
	.metric {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		min-width: 0;
		min-height: 112px;
		padding: var(--sp-3) var(--sp-4) var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
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
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
		/* the metric's accent, run toward the ink so it holds AA at this size */
		color: color-mix(in srgb, var(--metric-accent) 60%, var(--ink));
		align-self: flex-end;
		margin-top: -18px; /* sit on the chart's top-right, over the 1.0 tick line */
	}

	.plot {
		display: flex;
		gap: 6px;
		min-width: 0;
		flex: 1;
	}

	/* The 0–1 axis: three ticks so the eye has a scale for the line. */
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
		min-height: 62px;
	}

	/* A stat card centres its big number in the space a chart would fill — margin auto, so it stays
	   centred however tall the grid stretches the card. */
	.big {
		margin-block: auto;
		font-size: var(--fs-name);
		font-weight: var(--fw-semibold);
		color: var(--ink);
	}

	.big :global(.dim) {
		font-size: var(--fs-md);
		font-weight: var(--fw-regular);
		color: var(--ink3);
	}
</style>
