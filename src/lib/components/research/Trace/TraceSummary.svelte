<!--
  The Trace's context, for the console's right sidebar: what the last study found — how high the
  population climbed and how many of its evolved school survive where random brains don't — with the
  door into the report. Reads only the trace store; shows the honest prompt until a study is run.
-->
<script lang="ts">
	import { trace } from '$lib/state';
	import { formatSurvivalPct } from '$lib/format';
	import SummaryPanel from '../SummaryPanel.svelte';
	import ReportButton from '../ReportButton.svelte';

	const result = $derived(trace.result);
	const finalSurvival = $derived(
		result && result.curve.length ? result.curve[result.curve.length - 1] : 0
	);
	const evolvedSurvivors = $derived(
		result ? result.evolved.trace.fish.filter((f) => !f.died).length : 0
	);
	const controlSurvivors = $derived(
		result ? result.control.trace.fish.filter((f) => !f.died).length : 0
	);
	const total = $derived(result ? result.evolved.trace.fish.length : 0);
</script>

{#if result}
	<SummaryPanel
		eyebrow="This trace"
		title={`Learned to ${formatSurvivalPct(finalSurvival)}`}
		detail={`over ${result.episodes} generations`}
		stats={[
			{ label: 'Evolved survive', value: `${evolvedSurvivors} / ${total}` },
			{ label: 'Random survive', value: `${controlSurvivors} / ${total}` }
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
