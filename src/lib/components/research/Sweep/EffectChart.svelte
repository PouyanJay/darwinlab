<!--
  The Sweep's conclusion: each factor's main effect on seconds survived, with its 95% bootstrap
  interval. Bars run from a centred zero line — right for a factor that helps, left for one that
  costs. A bar whose interval straddles zero is drawn muted: it is a knob that does nothing here, and
  the lab says so rather than rounding it into a finding.
-->
<script lang="ts">
	import type { FactorEffect } from '$lib/lab/sweep';

	interface Props {
		effects: FactorEffect[];
	}

	let { effects }: Props = $props();

	// A symmetric axis sized to the widest bar or whisker, so the zero line sits dead centre.
	const max = $derived(
		Math.max(
			0.1,
			...effects.flatMap((e) =>
				[e.effect.delta, e.effect.ci.lo, e.effect.ci.hi]
					.filter((v) => !Number.isNaN(v))
					.map(Math.abs)
			)
		)
	);
	const px = (v: number) => 50 + (v / max) * 50;
	const straddlesZero = (e: FactorEffect) => e.effect.ci.lo <= 0 && e.effect.ci.hi >= 0;

	/** Teal when a factor helps, coral when it costs, muted when its interval can't clear zero. */
	const barColor = (helps: boolean, flat: boolean) =>
		flat ? 'var(--ink3)' : helps ? 'var(--data-teal)' : 'var(--data-coral)';
</script>

<div class="effects">
	{#each effects as e (e.key)}
		{@const delta = e.effect.delta}
		{@const missing = Number.isNaN(delta)}
		{@const cost = delta < 0}
		{@const flat = missing || straddlesZero(e)}
		<div class="row">
			<span class="name">{e.label}</span>
			<div class="track">
				<div class="zero" aria-hidden="true"></div>
				{#if !missing}
					<div
						class="bar"
						style:left="{Math.min(px(delta), 50)}%"
						style:width="{Math.abs(px(delta) - 50)}%"
						style:background={barColor(!cost, flat)}
					></div>
					<div
						class="whisk"
						style:left="{px(e.effect.ci.lo)}%"
						style:width="{px(e.effect.ci.hi) - px(e.effect.ci.lo)}%"
					></div>
				{/if}
			</div>
			<span class="val" class:cost class:flat>
				{missing ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}s`}
			</span>
		</div>
	{/each}
</div>

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
