<!--
  The Trace's context, for the console's right sidebar: what the last study found — how high the
  population climbed and how many of its evolved school survive where random brains don't — with the
  door into the report. Reads only the trace store; shows the honest prompt until a study is run.
-->
<script lang="ts">
	import { trace } from '$lib/state';
	import { traceSummary } from '$lib/harness/traceStudy';
	import { formatSurvivalPct } from '$lib/format';
	import SummaryPanel from '../SummaryPanel.svelte';
	import ReportButton from '../ReportButton.svelte';

	const result = $derived(trace.result);
	// One reader for the study's headline numbers, shared with the notebook finding (traceFindings), so
	// the sidebar and the report can never disagree about the same study.
	const summary = $derived(result ? traceSummary(result) : null);
</script>

{#if result && summary}
	<SummaryPanel
		eyebrow="This trace"
		title={`Learned to ${formatSurvivalPct(summary.finalSurvival)}`}
		detail={`over ${result.episodes} generations`}
		stats={[
			{ label: 'Evolved survive', value: `${summary.evolvedSurvivors} / ${summary.total}` },
			{ label: 'Random survive', value: `${summary.controlSurvivors} / ${summary.total}` }
		]}
	>
		<ReportButton inReport={trace.inReport} onadd={() => trace.addToReport()} />
	</SummaryPanel>
{:else}
	<SummaryPanel
		eyebrow="This trace"
		empty="Run a behaviour trace to see whether the population learned, and how it survives."
	/>
{/if}
