<!--
  The Sweep's run context, for the console's right sidebar: the one honest headline of the last run
  (the strongest factor whose interval clears zero) and its size. Reads only the sweep store; nothing
  measures here, and the empty state says plainly there is nothing to summarise yet.
-->
<script lang="ts">
	import { sweep, app, findings } from '$lib/state';
	import { configHash } from '$lib/lab/run';
	import { formatSignedSeconds } from '$lib/format';
	import ReportButton from '../ReportButton.svelte';
	import type { FactorEffect } from '$lib/lab/sweep';

	/** The strongest factor whose 95% interval clears zero — or null when nothing did, which is itself
	 *  a real result the Sweep keeps (a flat environment), not a gap to paper over. */
	const lead = $derived.by<FactorEffect | null>(() => {
		const movers = sweep.effects.filter(
			(e) => !Number.isNaN(e.effect.delta) && !(e.effect.ci.lo <= 0 && e.effect.ci.hi >= 0)
		);
		if (movers.length === 0) return null;
		return movers.reduce((best, e) =>
			Math.abs(e.effect.delta) > Math.abs(best.effect.delta) ? e : best
		);
	});

	// Whether this subject already has a Sweep finding in the notebook — so the button reads "in
	// report" rather than inviting a duplicate. Reactive on both the notebook and the subject.
	const inReport = $derived(findings.has('sweep'));

	function addToReport(): void {
		findings.add({
			source: 'sweep',
			variant: '',
			title: lead
				? `${lead.label} ${formatSignedSeconds(lead.effect.delta)}`
				: 'No factor cleared zero',
			detail: lead
				? 'the strongest factor whose interval clears zero'
				: 'a flat environment — a real negative the Sweep keeps',
			status: lead ? 'ok' : 'limit',
			seeds: sweep.seeds,
			configHash: configHash([app.subjectBase('Sweep')])
		});
	}
</script>

<div class="panel">
	<span class="eyebrow">This run</span>
	{#if sweep.results}
		{#if lead}
			<div class="lead">
				<b>{lead.label} {formatSignedSeconds(lead.effect.delta)}</b>
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
		<ReportButton {inReport} onadd={addToReport} />
	{:else}
		<p class="empty">Run the Sweep to see this run's headline and its size.</p>
	{/if}
</div>

<style>
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

	.note {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.empty {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}
</style>
