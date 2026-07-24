<!--
  Q3 — is the winner real, or noise? Two arms plotted as intervals on a shared seconds axis, so you can
  SEE whether they separate: non-overlapping intervals are a supported "A beats B", overlapping ones the
  honest "no difference". The longer-surviving arm is drawn in the survival teal (it tracks the measured
  means, not the claim's hoped-for direction); the other stays grey. The Ledger and the Report share it.
-->
<script lang="ts">
	import Figure from './Figure.svelte';
	import DataTable from './DataTable.svelte';
	import { formatSeconds } from '$lib/format';
	import type { ArmRow } from '$lib/lab/evidence';

	let {
		arms,
		intervals = true,
		open
	}: {
		arms: ArmRow[];
		/** Draw the interval bars (vs just the mean dots). The Report's skeptic toggle flips this. */
		intervals?: boolean;
		/** Force the data table open (the Report's "show data" toggle). */
		open?: boolean;
	} = $props();

	// A shared axis spanning both arms' intervals, padded and never below zero (survival can't be).
	const axis = $derived.by(() => {
		const values = arms.flatMap((a) => [a.lo, a.hi, a.mean]).filter((v) => !Number.isNaN(v));
		if (values.length === 0) return { lo: 0, hi: 1 };
		const lo = Math.min(...values);
		const hi = Math.max(...values);
		const pad = Math.max(0.2, (hi - lo) * 0.2);
		return { lo: Math.max(0, lo - pad), hi: hi + pad };
	});
	const toPercent = (v: number) => ((v - axis.lo) / (axis.hi - axis.lo)) * 100;
	const ticks = $derived([axis.lo, (axis.lo + axis.hi) / 2, axis.hi]);
	const topMean = $derived(
		Math.max(...arms.map((a) => a.mean).filter((m) => !Number.isNaN(m)), -Infinity)
	);

	const label = $derived(
		arms.length === 0
			? 'Two arms on a shared survival axis: nothing measured yet.'
			: `Two arms on a shared survival axis: ${arms.map((a) => `${a.label} ${formatSeconds(a.mean)}`).join(' vs ')}.`
	);
	const rows = $derived(
		arms.map((a) => ({
			arm: a.label,
			mean: formatSeconds(a.mean),
			ci: `[${a.lo.toFixed(1)}, ${a.hi.toFixed(1)}]`
		}))
	);
</script>

<Figure {label} {open}>
	<div class="ab">
		{#each arms as arm (arm.label)}
			{@const won = !Number.isNaN(arm.mean) && arm.mean === topMean}
			<div class="armrow">
				<span class="arm" class:won>{arm.label}</span>
				<div class="track">
					<div class="baseline" aria-hidden="true"></div>
					{#if !Number.isNaN(arm.mean)}
						{#if intervals}
							<div
								class="ci"
								class:won
								style:left="{toPercent(arm.lo)}%"
								style:width="{Math.max(0, toPercent(arm.hi) - toPercent(arm.lo))}%"
							></div>
						{/if}
						<div class="dot" class:won style:left="{toPercent(arm.mean)}%"></div>
					{/if}
				</div>
			</div>
		{/each}
		<div class="axislabels" aria-hidden="true">
			{#each ticks as tick (tick)}
				<span style:left="{toPercent(tick)}%">{tick.toFixed(1)}s</span>
			{/each}
		</div>
	</div>

	{#snippet table()}
		<DataTable
			caption="Arms on a shared survival axis"
			columns={[
				{ key: 'arm', label: 'Arm', numeric: false },
				{ key: 'mean', label: 'Mean' },
				{ key: 'ci', label: '95% interval', numeric: false }
			]}
			{rows}
		/>
	{/snippet}
</Figure>

<style>
	.ab {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.armrow {
		display: grid;
		grid-template-columns: 108px 1fr;
		align-items: center;
		gap: var(--sp-3);
	}

	.arm {
		font-size: var(--fs-sm);
		color: var(--ink2);
		text-align: right;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.arm.won {
		color: var(--ink);
		font-weight: var(--fw-semibold);
	}

	.track {
		position: relative;
		height: 20px;
	}

	.baseline {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 3px;
		height: 1px;
		background: var(--line);
	}

	.ci {
		position: absolute;
		top: 8px;
		height: 4px;
		border-radius: 2px;
		background: var(--ink3);
		opacity: 0.5;
	}

	/* The winning arm's interval + mean in the survival teal, so the eye lands on it first. */
	.ci.won {
		background: var(--data-teal);
		opacity: 0.9;
	}

	.dot {
		position: absolute;
		top: 5px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--ink3);
		border: 2px solid var(--panel);
		transform: translateX(-50%);
	}

	.dot.won {
		background: var(--data-teal);
	}

	.axislabels {
		position: relative;
		height: 12px;
		margin-left: calc(108px + var(--sp-3));
	}

	.axislabels span {
		position: absolute;
		transform: translateX(-50%);
		font-size: 9px;
		font-variant-numeric: tabular-nums;
		color: var(--ink3);
	}
</style>
