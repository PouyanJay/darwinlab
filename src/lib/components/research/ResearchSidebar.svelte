<!--
  The console's right zone: context for whatever the workspace is showing.

  It is persistent and adapts to the active instrument — the Atlas's drilled point (the mini-tank and
  the door back to Studio), a quiet summary of the Sweep's last run, or the Ledger's active claim. Each
  panel reads only what its store already measured; nothing here fabricates a number. The summaries
  stay monochrome — the verdict's own colour lives on the VerdictCard in the workspace; this side is
  the calm ledger of it.
-->
<script lang="ts">
	import DrillCard from './Atlas/DrillCard.svelte';
	import { sweep, ledger, landscape } from '$lib/state';
	import type { Instrument } from './instruments';
	import type { FactorEffect } from '$lib/lab/sweep';

	let { active }: { active: Instrument } = $props();

	const drilled = $derived(landscape.selected !== null && landscape.field !== null);

	/** The strongest factor whose 95% interval clears zero — the one honest headline of the run, or
	 *  null when nothing cleared zero (itself a real result the Sweep keeps: a flat environment). */
	const sweepLead = $derived.by<FactorEffect | null>(() => {
		const movers = sweep.effects.filter(
			(e) => !Number.isNaN(e.effect.delta) && !(e.effect.ci.lo <= 0 && e.effect.ci.hi >= 0)
		);
		if (movers.length === 0) return null;
		return movers.reduce((best, e) =>
			Math.abs(e.effect.delta) > Math.abs(best.effect.delta) ? e : best
		);
	});

	const claim = $derived(ledger.active);
	const verdict = $derived(ledger.latestFor(claim.id));

	/** A signed seconds value, the way every readout in the lab shows an effect. */
	const secs = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}s`;
</script>

<div class="sidebar" data-testid="research-sidebar">
	{#if active === 'atlas'}
		{#if drilled}
			<DrillCard />
		{:else}
			<div class="panel">
				<span class="eyebrow">Drilled point</span>
				<p class="empty">
					Click a cell on the map — its world opens here, with the door back into Studio.
				</p>
			</div>
		{/if}
	{:else if active === 'sweep'}
		<div class="panel">
			<span class="eyebrow">This run</span>
			{#if sweep.results}
				{#if sweepLead}
					<div class="lead">
						<b>{sweepLead.label} {secs(sweepLead.effect.delta)}</b>
						<span>the strongest factor whose interval clears zero</span>
					</div>
				{:else}
					<div class="lead">
						<b>No factor cleared zero</b>
						<span>a flat environment — a real negative the Sweep keeps</span>
					</div>
				{/if}
				<dl class="statgrid">
					<div>
						<dt>Conditions</dt>
						<dd class="tabular">{sweep.cells.length}</dd>
					</div>
					<div>
						<dt>Seeds</dt>
						<dd class="tabular">{sweep.seeds}</dd>
					</div>
				</dl>
				{#if sweep.sampled}
					<p class="note">
						Sampled {sweep.cells.length} of {sweep.total} — the full factorial overflowed the cap.
					</p>
				{/if}
			{:else}
				<p class="empty">Run the Sweep to see this run's headline and its size.</p>
			{/if}
		</div>
	{:else if active === 'ledger'}
		<div class="panel">
			<span class="eyebrow">This claim</span>
			<div class="lead">
				<b class="claim-text">{claim.text}</b>
			</div>
			{#if verdict}
				<dl class="statgrid">
					<div>
						<dt>Verdict</dt>
						<dd class="cap">{verdict.verdict}</dd>
					</div>
					<div>
						<dt>Δ effect</dt>
						<dd class="tabular">{secs(verdict.delta)}</dd>
					</div>
					<div>
						<dt>Cohen's d</dt>
						<dd class="tabular">{verdict.d.toFixed(1)}</dd>
					</div>
					<div>
						<dt>Seeds</dt>
						<dd class="tabular">{verdict.seeds}</dd>
					</div>
				</dl>
				<p class="note">
					Run <b class="tabular">{verdict.configHash}</b> · pre-registered contrast, re-runs identical.
				</p>
			{:else}
				<p class="empty">Not tested yet — run this claim to settle it.</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		min-height: 0;
		overflow-y: auto;
		padding: var(--sp-6) var(--sp-5);
		background: var(--panel);
		border-left: 1px solid var(--line);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.lead {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--panel2);
	}

	.lead b {
		font-size: var(--fs-title);
		font-weight: var(--fw-semibold);
		color: var(--ink);
		letter-spacing: var(--tracking-tight);
	}

	.lead b.claim-text {
		font-family: var(--font-display);
		font-size: var(--fs-body);
		line-height: var(--leading-body);
	}

	.lead span {
		font-size: var(--fs-sm);
		color: var(--ink3);
	}

	.statgrid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		margin: 0;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--line);
	}

	.statgrid > div {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--sp-3) var(--sp-4);
		background: var(--panel);
	}

	.statgrid dt {
		font-size: var(--fs-sm);
		color: var(--ink3);
	}

	.statgrid dd {
		margin: 0;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.statgrid dd.cap {
		text-transform: capitalize;
	}

	.note {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.note b {
		color: var(--ink2);
		font-weight: var(--fw-semibold);
	}

	.empty {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}
</style>
