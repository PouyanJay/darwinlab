<!--
  The active claim's verdict — the two arms plotted as intervals on a shared seconds axis, so you can
  SEE whether they separate, plus the numbers the verdict rests on. Non-overlapping intervals are a
  supported "A beats B"; overlapping ones are the honest "no difference". The run button is here
  because a verdict is a thing you commit to running, not a passive readout.
-->
<script lang="ts">
	import Button from '../../common/Button.svelte';
	import RunProgress from '../RunProgress.svelte';
	import { ledger } from '$lib/state';

	const claim = $derived(ledger.active);
	const entry = $derived(ledger.latestFor(claim.id));

	// A shared axis spanning both arms' intervals, padded and never below zero (survival can't be).
	const axis = $derived.by(() => {
		const values = (entry?.arms ?? [])
			.flatMap((arm) => [arm.ci.lo, arm.ci.hi, arm.mean])
			.filter((v) => !Number.isNaN(v));
		if (values.length === 0) return { lo: 0, hi: 1 };
		const lo = Math.min(...values);
		const hi = Math.max(...values);
		const pad = Math.max(0.2, (hi - lo) * 0.2);
		return { lo: Math.max(0, lo - pad), hi: hi + pad };
	});
	const toPercent = (v: number) => ((v - axis.lo) / (axis.hi - axis.lo)) * 100;
	const ticks = $derived([axis.lo, (axis.lo + axis.hi) / 2, axis.hi]);
	const fmt = (v: number) => (v > 0 ? '+' : '') + v.toFixed(1);

	// The longer-surviving arm is drawn teal, the other grey — so "which one won" reads at a glance,
	// honestly (it tracks the measured means, not the claim's hoped-for direction).
	const topMean = $derived(
		Math.max(...(entry?.arms ?? []).map((a) => a.mean).filter((m) => !Number.isNaN(m)), -Infinity)
	);
</script>

<div class="verdict">
	<span class="eyebrow">Verdict</span>
	<!-- h2: the next heading level under the page's h1 (the wordmark), so the outline has no gap. -->
	<h2>{claim.text}</h2>

	{#if entry}
		<div class="ab" data-testid="verdict-plot">
			{#each entry.arms as arm (arm.label)}
				{@const won = !Number.isNaN(arm.mean) && arm.mean === topMean}
				<div class="armrow">
					<span class="arm" class:won>{arm.label}</span>
					<div class="track">
						<div class="baseline" aria-hidden="true"></div>
						{#if !Number.isNaN(arm.mean)}
							<div
								class="ci"
								class:won
								style:left="{toPercent(arm.ci.lo)}%"
								style:width="{Math.max(0, toPercent(arm.ci.hi) - toPercent(arm.ci.lo))}%"
							></div>
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

		<div class="design">
			design · 2 arms · {entry.seeds} seeds · run <b>{entry.configHash}</b>
		</div>

		<div class="chips">
			<span class="chip verdict-{entry.verdict}">{entry.verdict.toUpperCase()}</span>
			<span class="chip">Δ {fmt(entry.delta)}s</span>
			<span class="chip">95% [{fmt(entry.ci.lo)}, {fmt(entry.ci.hi)}]</span>
			{#if !Number.isNaN(entry.d)}<span class="chip">d {entry.d.toFixed(1)}</span>{/if}
		</div>
	{:else}
		<p class="untested">
			This claim has not been tested yet. Running it measures both arms across {ledger.runSeeds} seeds
			and returns a verdict — supported or refuted — that goes into the record below.
		</p>
	{/if}

	<div class="actions">
		{#if ledger.running}
			<RunProgress progress={ledger.progress} oncancel={() => ledger.cancel()} />
		{:else}
			<Button variant="primary" size="sm" onclick={() => ledger.run(claim.id)}>
				{entry ? 'Run again' : 'Run this test'}
			</Button>
		{/if}
	</div>
</div>

<style>
	.verdict {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
		padding: var(--sp-5);
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	h2 {
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: var(--fw-semibold);
		letter-spacing: -0.01em;
		margin: -2px 0 0;
		line-height: 1.25;
		color: var(--ink);
	}

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
		background: rgb(14, 148, 136);
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
		background: rgb(14, 148, 136);
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

	.design {
		font-size: var(--fs-sm);
		color: var(--ink3);
		border-top: 1px solid var(--line2);
		padding-top: var(--sp-3);
	}

	.design b {
		color: var(--ink2);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2);
	}

	.chip {
		font-size: var(--fs-xs);
		font-variant-numeric: tabular-nums;
		border: 1px solid var(--line);
		border-radius: var(--radius-chip);
		padding: 3px 9px;
		color: var(--ink2);
	}

	/* The verdict word carries the weight: supported wears the survival teal, refuted the danger hue. */
	.chip.verdict-supported {
		color: var(--ink);
		background: color-mix(in oklab, rgb(14, 148, 136) 18%, transparent);
		border-color: rgb(14, 148, 136);
		font-weight: var(--fw-semibold);
	}

	.chip.verdict-refuted {
		color: var(--danger-ink);
		border-color: color-mix(in oklab, var(--danger) 40%, transparent);
		font-weight: var(--fw-semibold);
	}

	.untested {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.actions {
		display: flex;
	}
</style>
