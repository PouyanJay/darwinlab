<!--
  The Sweep's run context, for the console's right sidebar: the one honest headline of the last run
  (the strongest factor whose interval clears zero) and its size. Reads only the sweep store; nothing
  measures here, and the empty state says plainly there is nothing to summarise yet.
-->
<script lang="ts">
	import { sweep, app, findings } from '$lib/state';
	import { configHash } from '$lib/lab/run';
	import { toEffectRows } from '$lib/lab/sweep';
	import { strongestEffect, type EffectRow } from '$lib/lab/evidence';
	import { formatSignedSeconds } from '$lib/format';
	import SummaryPanel from '../SummaryPanel.svelte';
	import ReportButton from '../ReportButton.svelte';

	const effectRows = $derived(toEffectRows(sweep.effects));

	/** The strongest factor whose 95% interval clears zero — the SHARED selector, so this lead and
	 *  the workspace's headline tile can never disagree. Null = a flat environment, a real result. */
	const lead = $derived.by<EffectRow | null>(() => strongestEffect(effectRows));

	// Whether this subject already has a Sweep finding in the notebook — so the button reads "in
	// report" rather than inviting a duplicate. Reactive on both the notebook and the subject.
	const inReport = $derived(findings.has('sweep'));

	function addToReport(): void {
		findings.add({
			source: 'sweep',
			variant: '',
			title: lead ? `${lead.label} ${formatSignedSeconds(lead.delta)}` : 'No factor cleared zero',
			detail: lead
				? 'the strongest factor whose interval clears zero'
				: 'a flat environment — a real negative the Sweep keeps',
			status: lead ? 'ok' : 'limit',
			// the RECEIPT's seeds — the run that happened, not wherever the panel's input sits now
			seeds: sweep.receipt?.seeds ?? sweep.seeds,
			configHash: configHash([app.subjectBase('Sweep')]),
			evidence: { kind: 'effects', effects: effectRows }
		});
	}
</script>

{#if sweep.results}
	<SummaryPanel
		eyebrow="This run"
		title={lead ? `${lead.label} ${formatSignedSeconds(lead.delta)}` : 'No factor cleared zero'}
		detail={lead
			? 'the strongest factor whose interval clears zero'
			: 'a flat environment — a real negative the Sweep keeps'}
		stats={[
			{ label: 'Conditions', value: String(sweep.cells.length) },
			{ label: 'Seeds', value: String(sweep.receipt?.seeds ?? sweep.seeds) }
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
