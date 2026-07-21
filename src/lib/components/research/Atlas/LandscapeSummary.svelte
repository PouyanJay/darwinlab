<!--
  The Atlas's landscape context, for the console's right sidebar: what the plane found — a threshold
  (the steepest fall-off, "the cliff") or a flat hold across the range — with the door into the report.
  Reads only the landscape store; shows nothing until a field is measured.
-->
<script lang="ts">
	import { landscape, app, findings } from '$lib/state';
	import { configHash } from '$lib/lab/run';
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
			configHash: configHash([app.subjectBase('Atlas')])
		});
	}
</script>

{#if field}
	<div class="panel">
		<span class="eyebrow">This landscape</span>
		<div class="lead">
			{#if falloff}
				<b>Cliff at {field.axisX.format(falloff.x)}</b>
				<span>survival drops {falloff.drop.toFixed(1)}s across one step in {field.axisX.label}</span
				>
			{:else}
				<b>No sharp threshold</b>
				<span>survival holds across {field.axisX.label} in range</span>
			{/if}
		</div>
		<dl class="statgrid">
			<div>
				<dt>Survival</dt>
				<dd class="tabular">{field.min.toFixed(1)}–{field.max.toFixed(1)}s</dd>
			</div>
			<div>
				<dt>Seeds</dt>
				<dd class="tabular">{landscape.seeds}</dd>
			</div>
		</dl>
		<ReportButton {inReport} onadd={addToReport} />
	</div>
{/if}

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
</style>
