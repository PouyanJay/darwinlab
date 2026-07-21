<!--
  Q1 — did evolution actually work? Per-generation survival, plotted over the generations it evolved
  for: a curve that climbs then holds is a population that learned and converged; a flat line on the
  floor is a trainer that never left it. The data is `Evaluation.curve` (survival FRACTIONS, 0–1). The
  axes are monochrome; the line and its fill are the survival teal — the one place colour is the data.
-->
<script lang="ts">
	import Figure from './Figure.svelte';
	import DataTable from './DataTable.svelte';

	let {
		curve,
		/** What one point means, for the reader — e.g. "fraction of each generation still alive at its end". */
		legend = 'fraction of each generation still alive when it ended'
	}: { curve: number[]; legend?: string } = $props();

	const W = 320;
	const H = 120;
	const PAD = { l: 6, r: 34, t: 10, b: 16 };
	const plotW = W - PAD.l - PAD.r;
	const plotH = H - PAD.t - PAD.b;

	const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
	const pct = (v: number) => `${Math.round(clamp01(v) * 100)}%`;

	const n = $derived(curve.length);
	const x = (i: number) => PAD.l + (n > 1 ? i / (n - 1) : 0) * plotW;
	const y = (v: number) => PAD.t + (1 - clamp01(v)) * plotH;
	const baseline = PAD.t + plotH;

	const line = $derived(curve.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' '));
	const area = $derived(
		n === 0
			? ''
			: `M ${x(0).toFixed(1)},${baseline} ` +
					curve.map((v, i) => `L ${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ') +
					` L ${x(n - 1).toFixed(1)},${baseline} Z`
	);
	const last = $derived(n ? curve[n - 1] : 0);

	const rows = $derived(curve.map((v, i) => ({ gen: i + 1, survival: pct(v) })));
	const label = $derived(
		n === 0
			? 'Learning curve: no data yet.'
			: `Learning curve: per-generation survival across ${n} generations, ending at ${pct(last)}.`
	);
</script>

<Figure {label}>
	<svg viewBox="0 0 {W} {H}" aria-hidden="true">
		<!-- gridlines at 50% and the 0% baseline — monochrome, so the curve reads over them -->
		<line class="grid" x1={PAD.l} x2={W - PAD.r} y1={y(0.5)} y2={y(0.5)} />
		<line class="axis" x1={PAD.l} x2={W - PAD.r} y1={baseline} y2={baseline} />
		{#if n > 0}
			<path class="area" d={area} />
			<polyline class="line" points={line} />
			<circle class="end" cx={x(n - 1)} cy={y(last)} r="2.5" />
			<text class="endlabel" x={x(n - 1) + 5} y={y(last)} dominant-baseline="middle"
				>{pct(last)}</text
			>
		{/if}
	</svg>

	<div class="legend"><span class="swatch" aria-hidden="true"></span>{legend}</div>

	{#snippet table()}
		<DataTable
			caption="Survival by generation"
			columns={[
				{ key: 'gen', label: 'Gen' },
				{ key: 'survival', label: 'Survival' }
			]}
			{rows}
		/>
	{/snippet}
</Figure>

<style>
	svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.grid {
		stroke: var(--line);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}

	.axis {
		stroke: var(--line);
		stroke-width: 1;
	}

	.area {
		fill: var(--data-teal);
		opacity: 0.14;
	}

	.line {
		fill: none;
		stroke: var(--data-teal);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.end {
		fill: var(--data-teal);
	}

	.endlabel {
		fill: var(--ink2);
		font-size: 10px;
		font-variant-numeric: tabular-nums;
	}

	.legend {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: var(--fs-sm);
		color: var(--ink3);
	}

	.swatch {
		width: 13px;
		height: 3px;
		border-radius: 2px;
		background: var(--data-teal);
	}
</style>
