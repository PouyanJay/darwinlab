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
	<span class="eyebrow">Verdict</span>
	<!-- h2: the next heading level under the page's h1 (the wordmark), so the outline has no gap. -->
	<h2>{claim.text}</h2>

	{#if entry}
		<div data-testid="verdict-plot">
			<IntervalPlot arms={armRows} />
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
		background: color-mix(in oklab, var(--data-teal) 18%, transparent);
		border-color: var(--data-teal);
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
