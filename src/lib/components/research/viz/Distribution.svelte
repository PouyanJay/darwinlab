<!--
  Q3 — is the result real, or noise? One dot per seed, laid along a survival axis in seconds: a tight
  clump is a finding that reproduces; a smear from floor to ceiling is a result the random seed
  decided, not the sense. `returns` are the per-seed mean lifespans; when a `mean` and its bootstrap
  `ci` are supplied we mark them in teal — the one place colour is the data — over the monochrome
  dots and axis.
-->
<script lang="ts">
	import Figure from './Figure.svelte';
	import DataTable from './DataTable.svelte';

	let { returns, ci, mean }: { returns: number[]; ci?: { lo: number; hi: number }; mean?: number } =
		$props();

	const W = 320;
	const H = 70;
	const PAD = { l: 12, r: 12 };
	const plotW = W - PAD.l - PAD.r;
	const AXIS_Y = 50; // the number line the dots sit above
	const DOT_Y = 27; // the strip of dots
	const BAND_TOP = 15;
	const BAND_H = 24;

	const secs = (v: number) => `${v.toFixed(1)}s`;

	const n = $derived(returns.length);
	// The axis spans the data's own range, padded ~5% so the extreme dots aren't jammed on the edge.
	// A flat run — every seed identical — has no range, so fall back to a small span to divide by.
	const lo = $derived(n ? Math.min(...returns) : 0);
	const hi = $derived(n ? Math.max(...returns) : 0);
	const pad = $derived((hi - lo) * 0.05 || 0.5);
	const domainLo = $derived(lo - pad);
	const domainHi = $derived(hi + pad);
	const x = (v: number) => PAD.l + ((v - domainLo) / (domainHi - domainLo)) * plotW;

	const dots = $derived(returns.map((v, i) => ({ seed: i + 1, cx: x(v) })));
	const meanX = $derived(mean === undefined ? null : x(mean));
	const ciBand = $derived(ci ? { x: x(ci.lo), w: x(ci.hi) - x(ci.lo) } : null);

	const rows = $derived(returns.map((v, i) => ({ seed: i + 1, seconds: secs(v) })));

	const legend = $derived(
		mean !== undefined && ci
			? 'mean and its 95% interval'
			: mean !== undefined
				? 'mean'
				: '95% interval'
	);

	const label = $derived.by(() => {
		if (n === 0) return 'Per-seed survival: no seeds yet.';
		const parts = [`${n} seeds`];
		if (mean !== undefined) parts.push(`mean ${secs(mean)}`);
		if (ci) parts.push(`95% interval ${ci.lo.toFixed(1)}–${ci.hi.toFixed(1)}s`);
		return `Per-seed survival: ${parts.join(', ')}.`;
	});
</script>

<Figure {label}>
	<svg viewBox="0 0 {W} {H}" aria-hidden="true">
		{#if n > 0}
			<!-- the interval, faint, behind the dots — the range the mean could plausibly sit in -->
			{#if ciBand}
				<rect class="ci" x={ciBand.x} y={BAND_TOP} width={ciBand.w} height={BAND_H} />
			{/if}

			<line class="axis" x1={PAD.l} x2={W - PAD.r} y1={AXIS_Y} y2={AXIS_Y} />
			<line class="tick" x1={x(lo)} x2={x(lo)} y1={AXIS_Y - 3} y2={AXIS_Y + 3} />
			{#if hi !== lo}
				<line class="tick" x1={x(hi)} x2={x(hi)} y1={AXIS_Y - 3} y2={AXIS_Y + 3} />
			{/if}

			{#each dots as dot (dot.seed)}
				<circle class="dot" cx={dot.cx} cy={DOT_Y} r="2.2" />
			{/each}

			<!-- the mean, on top, so it reads over the densest clump of dots -->
			{#if meanX !== null}
				<line class="mean" x1={meanX} x2={meanX} y1="13" y2="41" />
			{/if}

			<text class="axislabel" x={x(lo)} y="64" text-anchor="start">{secs(lo)}</text>
			{#if hi !== lo}
				<text class="axislabel" x={x(hi)} y="64" text-anchor="end">{secs(hi)}</text>
			{/if}
		{/if}
	</svg>

	{#if mean !== undefined || ci}
		<div class="legend"><span class="swatch" aria-hidden="true"></span>{legend}</div>
	{/if}

	{#snippet table()}
		<DataTable
			caption="Survival by seed"
			columns={[
				{ key: 'seed', label: 'Seed' },
				{ key: 'seconds', label: 'Seconds' }
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

	.ci {
		fill: var(--data-teal);
		opacity: 0.12;
	}

	.axis,
	.tick {
		stroke: var(--line);
		stroke-width: 1;
	}

	.dot {
		fill: var(--ink3);
		fill-opacity: 0.6;
	}

	.mean {
		stroke: var(--data-teal);
		stroke-width: 1.5;
	}

	.axislabel {
		fill: var(--ink3);
		font-size: 9px;
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
		width: 3px;
		height: 13px;
		border-radius: 1px;
		background: var(--data-teal);
	}
</style>
