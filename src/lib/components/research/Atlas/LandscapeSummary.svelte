<!--
  The Atlas's landscape context, for the console's right sidebar: what the plane found — a threshold
  (the steepest fall-off, "the cliff") or a flat hold across the range — with the door into the report.
  Reads only the landscape store; shows nothing until a field is measured.
-->
<script lang="ts">
	import { landscape, app, findings } from '$lib/state';
	import { configHash } from '$lib/lab/run';
	import { xMarginal } from '$lib/lab/landscape';
	import SummaryPanel from '../SummaryPanel.svelte';
	import ReportButton from '../ReportButton.svelte';

	const field = $derived(landscape.field);
	const falloff = $derived(landscape.falloff);
	const inReport = $derived(findings.has('atlas'));

	function addToReport(): void {
		if (!field) return;
		findings.add({
			source: 'atlas',
			variant: '',
			title: falloff
				? `Cliff at ${field.axisX.format(falloff.x)}`
				: `No sharp threshold in ${field.axisX.label}`,
			detail: falloff
				? `survival drops ${falloff.drop.toFixed(1)}s across the step`
				: `survival holds ${field.min.toFixed(1)}–${field.max.toFixed(1)}s across the plane`,
			status: 'ok',
			seeds: landscape.seeds,
			configHash: configHash([app.subjectBase('Atlas')]),
			evidence: {
				kind: 'landscape',
				axisLabel: field.axisX.label,
				axisKey: field.axisX.key,
				band: xMarginal(field),
				cliffX: falloff?.x
			}
		});
	}
</script>

{#if field}
	<SummaryPanel
		eyebrow="This landscape"
		title={falloff ? `Cliff at ${field.axisX.format(falloff.x)}` : 'No sharp threshold'}
		detail={falloff
			? `survival drops ${falloff.drop.toFixed(1)}s across one step in ${field.axisX.label}`
			: `survival holds across ${field.axisX.label} in range`}
		stats={[
			{ label: 'Survival', value: `${field.min.toFixed(1)}–${field.max.toFixed(1)}s` },
			{ label: 'Seeds', value: String(landscape.seeds) }
		]}
	>
		<ReportButton {inReport} onadd={addToReport} />
	</SummaryPanel>
{/if}
