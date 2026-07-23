<!--
  The cliff, read as a curve — two rows of the map (the Y axis's low and high extremes) drawn as
  survival-vs-X lines, each with its own measured edge marked in gold. This is the map's geometry
  turned into the Q4 sentence: where the edge is, and what moves it. Reads the landscape store's
  frozen field only; nothing here measures.
-->
<script lang="ts">
	import { landscape } from '$lib/state';
	import { rowCliffs } from '$lib/lab/landscape';

	const field = $derived(landscape.field);
	const sections = $derived(landscape.sections);

	const W = 520;
	const H = 172;
	const LEFT = 46;
	const RIGHT = 500;
	const TOP = 16;
	const BOTTOM = 136;

	// One shared survival scale over both rows' finite values, padded so a flat line is not glued
	// to an edge of the frame.
	const scale = $derived.by(() => {
		const values = sections
			.flatMap((section) => section.points.map((p) => p.survival))
			.filter((v) => Number.isFinite(v));
		if (!values.length) return { lo: 0, hi: 1 };
		const lo = Math.min(...values);
		const hi = Math.max(...values);
		const pad = Math.max(0.2, (hi - lo) * 0.15);
		return { lo: Math.max(0, lo - pad), hi: hi + pad };
	});

	const sx = $derived((x: number) =>
		field
			? LEFT +
				((x - field.axisX.min) / Math.max(1e-9, field.axisX.max - field.axisX.min)) * (RIGHT - LEFT)
			: LEFT
	);
	const sy = $derived(
		(v: number) => BOTTOM - ((v - scale.lo) / Math.max(1e-9, scale.hi - scale.lo)) * (BOTTOM - TOP)
	);

	const path = (points: { x: number; survival: number }[]) =>
		points
			.filter((p) => Number.isFinite(p.survival))
			.map((p) => `${sx(p.x).toFixed(1)},${sy(p.survival).toFixed(1)}`)
			.join(' ');

	/** Each drawn section's edge — its row's measured fall-off midpoint, or null when the row never falls. */
	const edges = $derived.by(() => {
		if (!field) return [];
		const cliffs = rowCliffs(field);
		return [cliffs[0] ?? null, cliffs[field.rows - 1] ?? null];
	});

	const gridY = $derived([0.25, 0.5, 0.75].map((f) => BOTTOM - f * (BOTTOM - TOP)));
	const midValue = $derived((scale.lo + scale.hi) / 2);
</script>

{#if field && sections.length === 2}
	<svg
		viewBox="0 0 {W} {H}"
		role="img"
		aria-label="survival against {field.axisX.label}, at the low and high {field.axisY.label} rows"
		data-testid="cliff-section"
	>
		<line x1={LEFT} y1={BOTTOM} x2={RIGHT} y2={BOTTOM} class="base" />
		{#each gridY as y (y)}
			<line x1={LEFT} y1={y} x2={RIGHT} y2={y} class="grid" />
		{/each}
		<text x={LEFT - 6} y={BOTTOM + 3} class="tick" text-anchor="end">{scale.lo.toFixed(1)}s</text>
		<text x={LEFT - 6} y={sy(midValue) + 3} class="tick" text-anchor="end"
			>{midValue.toFixed(1)}s</text
		>
		<text x={LEFT} y={H - 14} class="tick">{field.axisX.format(field.axisX.min)}</text>
		<text x={RIGHT} y={H - 14} class="tick" text-anchor="end"
			>{field.axisX.format(field.axisX.max)}</text
		>

		{#each edges as edge, i (i)}
			{#if edge}
				<line
					x1={sx(edge.x)}
					y1={TOP + 8}
					x2={sx(edge.x)}
					y2={BOTTOM}
					class="edge"
					class:faint={i === 1}
				/>
			{/if}
		{/each}

		<polyline points={path(sections[0].points)} class="row low" />
		<polyline points={path(sections[1].points)} class="row high" />

		<text x={LEFT + 6} y={TOP + 10} class="rowlabel low"
			>{field.axisY.label.toLowerCase()} {field.axisY.format(sections[0].y)}</text
		>
		<text x={LEFT + 6} y={TOP + 24} class="rowlabel high"
			>{field.axisY.label.toLowerCase()} {field.axisY.format(sections[1].y)}</text
		>
	</svg>
{/if}

<style>
	svg {
		width: 100%;
		height: auto;
		display: block;
	}

	.base {
		stroke: color-mix(in oklab, var(--ink) 14%, transparent);
	}

	.grid {
		stroke: color-mix(in oklab, var(--ink) 7%, transparent);
	}

	.tick {
		font-size: 9px;
		fill: var(--ink3);
		font-variant-numeric: tabular-nums;
	}

	.edge {
		stroke: color-mix(in oklab, var(--gold-ink) 45%, transparent);
		stroke-dasharray: 3 3;
	}

	.edge.faint {
		stroke: color-mix(in oklab, var(--gold-ink) 28%, transparent);
	}

	.row {
		fill: none;
		stroke-width: 2;
	}

	.row.low {
		stroke: var(--data-teal);
	}

	.row.high {
		stroke: color-mix(in oklab, var(--ink) 40%, transparent);
	}

	.rowlabel {
		font-size: 10px;
		font-weight: 600;
	}

	.rowlabel.low {
		fill: var(--data-teal);
	}

	.rowlabel.high {
		fill: var(--ink3);
	}
</style>
