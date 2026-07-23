<!--
  The interaction plot: mean survival at each of factor A's levels, one line per extreme of factor
  B. PARALLEL lines are the null; the gap growing (or shrinking) along A is exactly the quantity the
  interaction contrast put an interval on. Two series, direct-labelled at their right ends — teal for
  B's top arm, ink for its bottom (identity is never colour-alone: the labels name the arms).
-->
<script lang="ts">
	let {
		x,
		bottom,
		top,
		bFrom,
		bTo,
		bLabel
	}: {
		x: string[];
		bottom: (number | null)[];
		top: (number | null)[];
		bFrom: string;
		bTo: string;
		bLabel: string;
	} = $props();

	const W = 520;
	const H = 170;
	const PAD = { left: 46, right: 84, top: 12, bottom: 34 };

	const values = $derived([...bottom, ...top].filter((v): v is number => v != null));
	const lo = $derived(values.length ? Math.min(...values) : 0);
	const hi = $derived(values.length ? Math.max(...values) : 1);
	const span = $derived(hi - lo || 1);

	const px = (i: number) =>
		PAD.left + (x.length === 1 ? 0.5 : i / (x.length - 1)) * (W - PAD.left - PAD.right);
	const py = (v: number) => H - PAD.bottom - ((v - lo) / span) * (H - PAD.top - PAD.bottom);

	const path = (series: (number | null)[]) =>
		series
			.map((v, i) => (v == null ? null : `${px(i)},${py(v)}`))
			.filter(Boolean)
			.join(' ');

	/** The y at a series' last real point — where its direct label sits. */
	const labelY = (series: (number | null)[]) => {
		for (let i = series.length - 1; i >= 0; i--) {
			const v = series[i];
			if (v != null) return py(v);
		}
		return H / 2;
	};
</script>

<svg viewBox="0 0 {W} {H}" role="img" aria-label="interaction: one line per {bLabel} extreme">
	<!-- recessive grid: the floor and a midline -->
	<line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} class="axis" />
	<line
		x1={PAD.left}
		y1={py(lo + span / 2)}
		x2={W - PAD.right}
		y2={py(lo + span / 2)}
		class="grid"
	/>
	<text x={PAD.left - 6} y={py(lo) + 3} class="tick" text-anchor="end">{lo.toFixed(1)}s</text>
	<text x={PAD.left - 6} y={py(hi) + 3} class="tick" text-anchor="end">{hi.toFixed(1)}s</text>

	{#each x as label, i (label)}
		<text x={px(i)} y={H - PAD.bottom + 16} class="tick" text-anchor="middle">{label}</text>
	{/each}

	<polyline points={path(bottom)} class="arm from" />
	{#each bottom as v, i (i)}
		{#if v != null}<circle cx={px(i)} cy={py(v)} r="3.5" class="dot from" />{/if}
	{/each}
	<text x={W - PAD.right + 8} y={labelY(bottom) + 3} class="arm-label from">{bFrom}</text>

	<polyline points={path(top)} class="arm to" />
	{#each top as v, i (i)}
		{#if v != null}<circle cx={px(i)} cy={py(v)} r="3.5" class="dot to" />{/if}
	{/each}
	<text x={W - PAD.right + 8} y={labelY(top) + 3} class="arm-label to">{bTo}</text>
</svg>

<style>
	svg {
		width: 100%;
		height: auto;
		display: block;
	}

	.axis {
		stroke: var(--line);
		stroke-width: 1;
	}

	.grid {
		stroke: var(--line);
		stroke-opacity: 0.5;
	}

	.tick {
		font-size: 9px;
		fill: var(--ink3);
		font-variant-numeric: tabular-nums;
	}

	.arm {
		fill: none;
		stroke-width: 2;
	}

	.arm.from {
		stroke: var(--ink3);
	}

	.arm.to {
		stroke: var(--data-teal);
	}

	.dot.from {
		fill: var(--ink3);
	}

	.dot.to {
		fill: var(--data-teal);
	}

	.arm-label {
		font-size: 10px;
		font-weight: 600;
	}

	.arm-label.from {
		fill: var(--ink3);
	}

	.arm-label.to {
		fill: var(--data-teal);
	}
</style>
