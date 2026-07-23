<!--
  Two averaged learning curves — one per arm of a factor — over the training generations. The
  convergence card's chart: a curve that plateaus proves the budget was enough; one still climbing
  at the right edge is the under-trained warning made visible. Survival fraction on y (the engine's
  lifeCurve), generations on x. Direct labels at the right ends; teal = the factor's top arm.
-->
<script lang="ts">
	import Figure from './Figure.svelte';
	import DataTable from './DataTable.svelte';

	let {
		from,
		to,
		fromLabel,
		toLabel
	}: { from: number[]; to: number[]; fromLabel: string; toLabel: string } = $props();

	const W = 520;
	const H = 160;
	const PAD = { left: 46, right: 96, top: 12, bottom: 28 };

	const gens = $derived(Math.max(from.length, to.length));
	const values = $derived([...from, ...to]);
	const lo = $derived(values.length ? Math.min(...values) : 0);
	const hi = $derived(values.length ? Math.max(...values) : 1);
	const span = $derived(hi - lo || 1);

	const px = (i: number) =>
		PAD.left + (gens <= 1 ? 0.5 : i / (gens - 1)) * (W - PAD.left - PAD.right);
	const py = (v: number) => H - PAD.bottom - ((v - lo) / span) * (H - PAD.top - PAD.bottom);
	const path = (curve: number[]) => curve.map((v, i) => `${px(i)},${py(v)}`).join(' ');
	const endY = (curve: number[]) => (curve.length ? py(curve[curve.length - 1]) : H / 2);
	const pct = (v: number) => `${Math.round(v * 100)}%`;
</script>

<Figure
	label="Learning curves over the training generations: {toLabel} against {fromLabel} — a curve still climbing at the right edge is under-trained."
>
	<svg viewBox="0 0 {W} {H}">
		<line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} class="axis" />
		<text x={PAD.left - 6} y={py(lo) + 3} class="tick" text-anchor="end">{pct(lo)}</text>
		<text x={PAD.left - 6} y={py(hi) + 3} class="tick" text-anchor="end">{pct(hi)}</text>
		<text x={PAD.left} y={H - PAD.bottom + 16} class="tick">gen 1</text>
		<text x={W - PAD.right} y={H - PAD.bottom + 16} class="tick" text-anchor="end">gen {gens}</text>

		{#if from.length}
			<polyline points={path(from)} class="arm from" />
			<text x={W - PAD.right + 8} y={endY(from) + 3} class="arm-label from">{fromLabel}</text>
		{/if}
		{#if to.length}
			<polyline points={path(to)} class="arm to" />
			<text x={W - PAD.right + 8} y={endY(to) + 3} class="arm-label to">{toLabel}</text>
		{/if}
	</svg>

	{#snippet table()}
		<DataTable
			caption="Mean survival fraction per generation, one column per arm"
			columns={[
				{ key: 'gen', label: 'Gen' },
				{ key: 'from', label: fromLabel },
				{ key: 'to', label: toLabel }
			]}
			rows={Array.from({ length: gens }, (_, i) => ({
				gen: i + 1,
				from: from[i] == null ? '—' : `${Math.round(from[i] * 100)}%`,
				to: to[i] == null ? '—' : `${Math.round(to[i] * 100)}%`
			}))}
		/>
	{/snippet}
</Figure>

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
