<!--
  The Sweep's run context, for the console's right sidebar: the one honest headline of the last run
  (the strongest factor whose interval clears zero) and its size. Reads only the sweep store; nothing
  measures here, and the empty state says plainly there is nothing to summarise yet.
-->
<script lang="ts">
	import { sweep, app, findings } from '$lib/state';
	import { configHash } from '$lib/lab/run';
	import { formatSignedSeconds } from '$lib/format';
	import SummaryPanel from '../SummaryPanel.svelte';
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

{#if sweep.results}
	<SummaryPanel
		eyebrow="This run"
		title={lead
			? `${lead.label} ${formatSignedSeconds(lead.effect.delta)}`
			: 'No factor cleared zero'}
		detail={lead
			? 'the strongest factor whose interval clears zero'
			: 'a flat environment — a real negative the Sweep keeps'}
		stats={[
			{ label: 'Conditions', value: String(sweep.cells.length) },
			{ label: 'Seeds', value: String(sweep.seeds) }
		]}
	>
		{#if sweep.sampled}
			<p class="note">
				Sampled {sweep.cells.length} of {sweep.total} — the full factorial overflowed the cap.
			</p>
		{/if}
		<ReportButton {inReport} onadd={addToReport} />
	</SummaryPanel>
{:else}
	<SummaryPanel eyebrow="This run" empty="Run the Sweep to see this run's headline and its size." />
{/if}

<style>
	.note {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}
</style>
