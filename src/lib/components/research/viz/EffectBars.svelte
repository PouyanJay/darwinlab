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

	let {
		effects,
		intervals = true,
		open
	}: {
		effects: EffectRow[];
		/** Draw the 95% interval whiskers. The Report's skeptic toggle flips this; on by default, so
		 *  the Sweep (its other caller) is unchanged. */
		intervals?: boolean;
		/** Force the data table open (the Report's "show data" toggle). */
		open?: boolean;
	} = $props();

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

<Figure {label} {open}>
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
						{#if intervals}
							<div
								class="whisk"
								style:left="{px(e.lo)}%"
								style:width="{px(e.hi) - px(e.lo)}%"
							></div>
						{/if}
					{/if}
				</div>
				<span class="val" class:cost class:flat>
					{missing ? '—' : formatSignedSeconds(e.delta)}
				</span>
			</div>
		{/each}

		<!-- The magnitude axis: the symmetric survival-seconds scale the bars are drawn against, so a
		     reader can read a bar's length as a number, not just a direction. -->
		<div class="axis" aria-hidden="true">
			<span></span>
			<div class="ticks">
				<span class="tick lo">−{max.toFixed(1)}s</span>
				<span class="tick mid">0</span>
				<span class="tick hi">+{max.toFixed(1)}s</span>
			</div>
			<span></span>
		</div>
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

	.row,
	.axis {
		display: grid;
		grid-template-columns: 104px 1fr 56px;
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
		height: 24px;
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
		top: 5px;
		height: 14px;
		border-radius: 3px;
	}

	.whisk {
		position: absolute;
		top: 11px;
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

	/* The scale under the bars — its middle column lines up with the tracks above it, so its 0 sits on
	   the zero line and its ends mark the widest bar the axis can hold. */
	.axis {
		margin-top: 2px;
		padding-top: var(--sp-2);
		border-top: 1px solid var(--line);
	}

	.ticks {
		position: relative;
		height: 12px;
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
		font-variant-numeric: tabular-nums;
	}

	.tick {
		position: absolute;
		top: 0;
	}

	.tick.lo {
		left: 0;
	}

	.tick.mid {
		left: 50%;
		transform: translateX(-50%);
	}

	.tick.hi {
		right: 0;
	}
</style>
