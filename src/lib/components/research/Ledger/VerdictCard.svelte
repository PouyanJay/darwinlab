<!--
  The active claim's verdict — the two arms plotted as intervals on a shared seconds axis, so you can
  SEE whether they separate, plus the numbers the verdict rests on. Non-overlapping intervals are a
  supported "A beats B"; overlapping ones are the honest "no difference". The run button is here
  because a verdict is a thing you commit to running, not a passive readout.
-->
<script lang="ts">
	import Button from '../../common/Button.svelte';
	import RunProgress from '../RunProgress.svelte';
	import IntervalPlot from '../viz/IntervalPlot.svelte';
	import { ledger, toArmRows } from '$lib/state';

	const claim = $derived(ledger.active);
	const entry = $derived(ledger.latestFor(claim.id));
	const fmt = (v: number) => (v > 0 ? '+' : '') + v.toFixed(1);

	const armRows = $derived(toArmRows(entry?.arms ?? []));
</script>

<div class="verdict">
	<div class="vhead">
		<span class="eyebrow">Verdict</span>
		{#if entry}<span class="badge verdict-{entry.verdict}">{entry.verdict.toUpperCase()}</span>{/if}
	</div>
	<!-- h2: the next heading level under the page's h1 (the wordmark), so the outline has no gap. -->
	<h2>{claim.text}</h2>

	{#if entry}
		<div class="plot" data-testid="verdict-plot">
			<IntervalPlot arms={armRows} />
		</div>

		<div class="design">
			design · 2 arms · {entry.seeds} seeds · run <b>{entry.configHash}</b>
		</div>

		<div class="chips">
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
	/* The centrepiece: full width below the claims, roomier than a summary card so the interval plot has
	   the width to actually separate the two arms. */
	.verdict {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
		padding: var(--sp-6);
	}

	.vhead {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	/* The verdict word leads, prominent — supported wears the survival teal, refuted the danger hue. */
	.badge {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		border-radius: var(--radius-chip);
		padding: 3px 10px;
	}

	.badge.verdict-supported {
		color: var(--ink);
		background: color-mix(in oklab, var(--data-teal) 20%, transparent);
		border: 1px solid var(--data-teal);
	}

	.badge.verdict-refuted {
		color: var(--danger-ink);
		border: 1px solid color-mix(in oklab, var(--danger) 45%, transparent);
	}

	h2 {
		font-family: var(--font-display);
		font-size: var(--fs-report-headline, 26px);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-tight);
		margin: 0;
		line-height: 1.15;
		color: var(--ink);
		text-wrap: balance;
	}

	.plot {
		margin: var(--sp-2) 0;
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
