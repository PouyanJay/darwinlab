<!--
  Q4 — where does it hold, and where does it break? A compact 1-D survival gradient along one axis:
  each measured point is a segment, coloured on the survival ramp (coral = dies fast, teal = lasts),
  so a run of teal that drops to coral IS the cliff. Colour is normalised WITHIN the band — the worst
  point is coral, the best teal — so the strip reads as a relative landscape, not an absolute one. The
  chrome (ticks, cliff line, frame) is monochrome; the ramp is the only colour, because it's the data.
-->
<script lang="ts">
	import { heatColor } from '$lib/render';
	import Figure from './Figure.svelte';
	import DataTable from './DataTable.svelte';
	import { formatSeconds } from '$lib/format';

	let {
		band,
		axisLabel,
		format,
		/** Optional x where survival falls off hardest — drawn as a threshold marker on the strip. */
		cliffX,
		open
	}: {
		band: { x: number; survival: number }[];
		axisLabel: string;
		format: (x: number) => string;
		cliffX?: number;
		/** Force the data table open (the Report's "show data" toggle). */
		open?: boolean;
	} = $props();

	const W = 320;
	const H = 60;
	const STRIP_Y = 10;
	const STRIP_H = 22;
	const stripBottom = STRIP_Y + STRIP_H;

	const n = $derived(band.length);

	// Colour is normalised over the band's own survival range: the shortest-lived point sits at coral,
	// the longest at teal. A flat band has no low/high to distinguish, so it reads neutral (0.5).
	const segments = $derived.by(() => {
		if (n === 0) return [];
		const values = band.map((b) => b.survival);
		const min = Math.min(...values);
		const span = Math.max(...values) - min;
		const segW = W / n;
		return band.map((b, i) => ({
			x: i * segW,
			w: segW,
			color: heatColor(span > 0 ? (b.survival - min) / span : 0.5)
		}));
	});

	// The cliff's x, mapped through the band's x-range onto the strip and clamped to it.
	const cliffPx = $derived.by(() => {
		if (cliffX == null || n === 0) return null;
		const xMin = band[0].x;
		const range = band[n - 1].x - xMin;
		const px = range !== 0 ? ((cliffX - xMin) / range) * W : 0;
		return Math.max(0, Math.min(W, px));
	});
	// Keep the cliff label from spilling off either end.
	const cliffAnchor = $derived(
		cliffPx == null ? 'middle' : cliffPx < 24 ? 'start' : cliffPx > W - 24 ? 'end' : 'middle'
	);

	// Left / middle / right ticks, so the axis has scale without a full ruler.
	const ticks = $derived(
		n === 0
			? []
			: [
					{ x: 0, anchor: 'start', label: format(band[0].x) },
					{ x: W / 2, anchor: 'middle', label: format((band[0].x + band[n - 1].x) / 2) },
					{ x: W, anchor: 'end', label: format(band[n - 1].x) }
				]
	);

	const rows = $derived(band.map((b) => ({ x: format(b.x), survival: formatSeconds(b.survival) })));
	const label = $derived(
		n === 0
			? `Survival across ${axisLabel}: no data yet.`
			: `Survival across ${axisLabel}${cliffX != null ? `, with a threshold near ${format(cliffX)}` : ''}.`
	);
</script>

<Figure {label} {open}>
	<svg viewBox="0 0 {W} {H}" aria-hidden="true">
		<!-- the survival gradient: one segment per measured point, contiguous across the width -->
		{#each segments as seg, i (i)}
			<rect class="seg" x={seg.x} y={STRIP_Y} width={seg.w} height={STRIP_H} fill={seg.color} />
		{/each}
		{#if n > 0}
			<rect class="frame" x="0" y={STRIP_Y} width={W} height={STRIP_H} />
		{/if}

		{#if cliffPx != null}
			<g class="cliff">
				<line class="cliff-line" x1={cliffPx} x2={cliffPx} y1={STRIP_Y - 3} y2={stripBottom + 3} />
				<text class="cliff-label" x={cliffPx} y={STRIP_Y - 5} text-anchor={cliffAnchor}>cliff</text>
			</g>
		{/if}

		{#each ticks as tick (tick.x)}
			<text class="tick" x={tick.x} y={H - 6} text-anchor={tick.anchor}>{tick.label}</text>
		{/each}
	</svg>

	{#snippet table()}
		<DataTable
			caption={`Survival across ${axisLabel}`}
			columns={[
				{ key: 'x', label: axisLabel, numeric: false },
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

	.frame {
		fill: none;
		stroke: var(--line);
		stroke-width: 1;
	}

	.cliff-line {
		stroke: var(--ink);
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
	}

	.cliff-label {
		fill: var(--ink2);
		font-size: 9px;
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}

	.tick {
		fill: var(--ink3);
		font-size: 10px;
		font-variant-numeric: tabular-nums;
	}
</style>
