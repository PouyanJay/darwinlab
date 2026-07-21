<!--
  The Ledger's claim context, for the console's right sidebar: the active claim and — once it has been
  run — a quiet summary of its latest verdict (the record's numbers, not a colour; the coloured verdict
  lives on the VerdictCard in the workspace). Reads only the ledger store. Until the claim has been
  tested it says so, rather than inventing a verdict.
-->
<script lang="ts">
	import { ledger, findings } from '$lib/state';
	import { formatSignedSeconds } from '$lib/format';
	import SummaryPanel from '../SummaryPanel.svelte';
	import ReportButton from '../ReportButton.svelte';

	const claim = $derived(ledger.active);
	// The latest settled record for this claim (its name is `entry`, matching VerdictCard — the field
	// on it called `verdict` is the outcome word, which is exactly why the variable is not).
	const entry = $derived(ledger.latestFor(claim.id));
	const verdictLabel = $derived(
		entry ? entry.verdict[0].toUpperCase() + entry.verdict.slice(1) : ''
	);

	// One finding per claim per subject — so the button tracks THIS claim, not the Ledger in general.
	const inReport = $derived(findings.has('ledger', claim.id));

	function addToReport(): void {
		if (!entry) return;
		findings.add({
			source: 'ledger',
			variant: claim.id,
			title: claim.text,
			detail: `${entry.verdict} · Δ ${formatSignedSeconds(entry.delta)} · d ${entry.d.toFixed(1)}`,
			status: entry.verdict === 'supported' ? 'ok' : 'limit',
			seeds: entry.seeds,
			configHash: entry.configHash
		});
	}
</script>

{#if entry}
	<SummaryPanel
		eyebrow="This claim"
		title={claim.text}
		display
		stats={[
			{ label: 'Verdict', value: verdictLabel },
			{ label: 'Δ effect', value: formatSignedSeconds(entry.delta) },
			{ label: "Cohen's d", value: entry.d.toFixed(1) },
			{ label: 'Seeds', value: String(entry.seeds) }
		]}
	>
		<p class="note">
			Run <b class="tabular">{entry.configHash}</b> · pre-registered contrast, re-runs identical.
		</p>
		<ReportButton {inReport} onadd={addToReport} />
	</SummaryPanel>
{:else}
	<SummaryPanel
		eyebrow="This claim"
		title={claim.text}
		display
		empty="Not tested yet — run this claim to settle it."
	/>
{/if}

<style>
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
</style>
