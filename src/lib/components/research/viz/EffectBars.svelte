<!--
  Q2 — what actually moves survival? Each factor's main effect, with its 95% bootstrap interval. Bars
  run from a centred zero line — right for a factor that helps (teal), left for one that costs (coral).
  A bar whose interval straddles zero is drawn muted: it does nothing here, and the lab says so rather
  than rounding it into a finding. The Sweep and the Report both draw from this one component.
-->
<script lang="ts">
	import Figure from './Figure.svelte';
	import DataTable from './DataTable.svelte';
	import { formatSignedSeconds } from '$lib/format';
	import { isFlatEffect, type EffectRow } from '$lib/lab/evidence';

	let { effects }: { effects: EffectRow[] } = $props();

	// A symmetric axis sized to the widest bar or whisker, so the zero line sits dead centre.
	const max = $derived(
		Math.max(
			0.1,
			...effects.flatMap((e) => [e.delta, e.lo, e.hi].filter((v) => !Number.isNaN(v)).map(Math.abs))
		)
	);
	const px = (v: number) => 50 + (v / max) * 50;
	const barColor = (helps: boolean, flat: boolean) =>
		flat ? 'var(--ink3)' : helps ? 'var(--data-teal)' : 'var(--data-coral)';

	const movers = $derived(effects.filter((e) => !isFlatEffect(e)));
	const moversText = $derived(
		movers.map((e) => `${e.label} ${formatSignedSeconds(e.delta)}`).join(', ')
	);
	const label = $derived(
		effects.length === 0
			? 'Main effect on survival: nothing measured yet.'
			: movers.length
				? `Main effect on survival: ${moversText} clears zero.`
				: 'Main effect on survival: no factor clears zero.'
	);
	const rows = $derived(
		effects.map((e) => ({
			factor: e.label,
			effect: Number.isNaN(e.delta) ? '—' : formatSignedSeconds(e.delta),
			ci: Number.isNaN(e.lo) ? '—' : `[${formatSignedSeconds(e.lo)}, ${formatSignedSeconds(e.hi)}]`
		}))
	);
</script>

<Figure {label}>
	<div class="effects">
		{#each effects as e (e.label)}
			{@const missing = Number.isNaN(e.delta)}
			{@const cost = e.delta < 0}
			{@const flat = isFlatEffect(e)}
			<div class="row">
				<span class="name">{e.label}</span>
				<div class="track">
					<div class="zero" aria-hidden="true"></div>
					{#if !missing}
						<div
							class="bar"
							style:left="{Math.min(px(e.delta), 50)}%"
							style:width="{Math.abs(px(e.delta) - 50)}%"
							style:background={barColor(!cost, flat)}
						></div>
						<div class="whisk" style:left="{px(e.lo)}%" style:width="{px(e.hi) - px(e.lo)}%"></div>
					{/if}
				</div>
				<span class="val" class:cost class:flat>
					{missing ? '—' : formatSignedSeconds(e.delta)}
				</span>
			</div>
		{/each}
	</div>

	{#snippet table()}
		<DataTable
			caption="Main effect on survival"
			columns={[
				{ key: 'factor', label: 'Factor', numeric: false },
				{ key: 'effect', label: 'Effect' },
				{ key: 'ci', label: '95% interval', numeric: false }
			]}
			{rows}
		/>
	{/snippet}
</Figure>

<style>
	.effects {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.row {
		display: grid;
		grid-template-columns: 92px 1fr 52px;
		align-items: center;
		gap: var(--sp-3);
	}

	.name {
		font-size: var(--fs-sm);
		color: var(--ink);
		text-align: right;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.track {
		position: relative;
		height: 20px;
	}

	.zero {
		position: absolute;
		left: 50%;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--ink3);
		opacity: 0.6;
	}

	/* Colour is set inline from the survival palette (teal helps / coral costs / muted when flat). */
	.bar {
		position: absolute;
		top: 4px;
		height: 12px;
		border-radius: 3px;
	}

	.whisk {
		position: absolute;
		top: 9px;
		height: 1px;
		background: var(--ink2);
	}

	.whisk::before,
	.whisk::after {
		content: '';
		position: absolute;
		top: -4px;
		width: 1px;
		height: 9px;
		background: var(--ink2);
	}

	.whisk::before {
		left: 0;
	}

	.whisk::after {
		right: 0;
	}

	.val {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		text-align: right;
		color: var(--ink);
	}

	.val.cost {
		color: var(--danger-ink);
	}

	.val.flat {
		color: var(--ink3);
	}
</style>
