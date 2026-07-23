<!--
  The verdict — the workspace's centrepiece: the composed claim's sentence with its badge, the two
  arms plotted as intervals (the actual evidence the verdict was read from), and the numbers spelled
  out — Δ with its interval, effect size, seeds, fingerprint. The trigger is NOT here: composing and
  firing live in the design panel; this card reports what the last run of this claim settled.
-->
<script lang="ts">
	import IntervalPlot from '../viz/IntervalPlot.svelte';
	import { ledger, toArmRows } from '$lib/state';
	import { formatSigned, formatSignedSeconds } from '$lib/format';

	const claim = $derived(ledger.active);
	const entry = $derived(ledger.latestFor(claim.id));

	const armRows = $derived(toArmRows(entry?.arms ?? []));
</script>

<section class="verdict" data-testid="verdict-card">
	<header class="card-head">
		<span class="eyebrow">The verdict — latest run of the composed claim</span>
		{#if entry}
			<span class="meta tabular">{entry.seeds} seeds/arm · 95% CI · {entry.configHash}</span>
		{/if}
	</header>

	<div class="vhead">
		<!-- h3: the workspace's h2 is the instrument name, so the card's outline sits under it. -->
		<h3>{claim.text}</h3>
		{#if entry}<span class="badge verdict-{entry.verdict}">{entry.verdict.toUpperCase()}</span>{/if}
	</div>

	{#if entry}
		<div class="plot" data-testid="verdict-plot">
			<IntervalPlot arms={armRows} />
		</div>

		<div class="vstats">
			<span
				>Δ <b class="tabular">{formatSignedSeconds(entry.delta)}</b>
				<span class="ci tabular">[{formatSigned(entry.ci.lo)}, {formatSigned(entry.ci.hi)}]</span
				></span
			>
			{#if !Number.isNaN(entry.d)}<span
					>effect size d <b class="tabular">{entry.d.toFixed(1)}</b></span
				>{/if}
			<span>seeds <b class="tabular">{entry.seeds} / arm</b></span>
			<span>fingerprint <b class="tabular">{entry.configHash}</b></span>
		</div>

		<p class="read">
			The two arms are plotted as the evidence the verdict was read from: for an <b
				>A&nbsp;&gt;&nbsp;B</b
			>
			claim, supported means the whole Δ interval clears zero in A's favour — a shortfall <b>or</b>
			a straddle both refute it. For an <b>A&nbsp;≈&nbsp;B</b> claim the logic flips: a straddle supports,
			clearing zero refutes. The verdict is read off the pre-registered contrast, never argued after the
			fact.
		</p>
	{:else}
		<p class="untested">
			This claim has not been tested yet. Test it from the design panel — both arms run across
			{ledger.seeds} seeds and the verdict, supported or refuted, enters the record below.
		</p>
	{/if}
</section>

<style>
	.verdict {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
		padding: var(--sp-6);
	}

	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--sp-3);
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.meta {
		font-size: var(--fs-sm);
		color: var(--ink3);
		white-space: nowrap;
	}

	.vhead {
		display: flex;
		align-items: baseline;
		gap: var(--sp-3);
		flex-wrap: wrap;
	}

	h3 {
		font-family: var(--font-display);
		font-size: var(--fs-report-headline);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-tight);
		margin: 0;
		line-height: 1.15;
		color: var(--ink);
		text-wrap: balance;
	}

	/* The verdict word beside the sentence — supported wears the survival teal, refuted the danger
	   hue. The tints are a touch stronger than a chip's so they read at the badge's size. */
	.badge {
		flex: none;
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

	.plot {
		margin: var(--sp-2) 0;
	}

	.vstats {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-3) var(--sp-6);
		font-size: var(--fs-sm);
		color: var(--ink2);
		border-top: 1px solid var(--line2);
		padding-top: var(--sp-3);
	}

	.vstats b {
		color: var(--ink);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
	}

	.ci {
		color: var(--ink3);
		font-size: var(--fs-xs);
	}

	.read {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.read b {
		color: var(--ink2);
	}

	.untested {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}
</style>
