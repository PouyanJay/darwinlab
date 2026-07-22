<!--
  One question's detailed section in the Report. When a finding answers it, the section reads the
  finding's own words (never invented) and draws the right viz from its evidence, tagged with the test
  it came from. When nothing answers it, it says so plainly and names the test that would — no
  placeholder graph, no fabricated verdict.
-->
<script lang="ts">
	import EffectBars from '../viz/EffectBars.svelte';
	import IntervalPlot from '../viz/IntervalPlot.svelte';
	import LandscapeStrip from '../viz/LandscapeStrip.svelte';
	import LearningCurve from '../viz/LearningCurve.svelte';
	import BehaviorBars from '../viz/BehaviorBars.svelte';
	import { CANDIDATE_AXES } from '$lib/lab/landscape';
	import { SOURCE_LABEL } from '$lib/lab/questions';
	import type { ReportSection } from '$lib/state';

	let { section }: { section: ReportSection } = $props();

	const finding = $derived(section.finding);
	const evidence = $derived(finding?.evidence);

	/** The landscape axis's format fn, resolved from its persisted key (functions don't serialise). */
	const axisFormat = (key: string) =>
		CANDIDATE_AXES.find((a) => a.key === key)?.format ?? ((v: number) => String(v));
</script>

<section class="qsec" data-testid="report-q{section.question.id}">
	<div class="qlabel">
		<span class="qnum">{section.question.id}</span>
		<span class="qtitle">{section.question.title}</span>
		{#if finding}<span class="qsrc">← {SOURCE_LABEL[finding.source]}</span>{/if}
	</div>

	{#if finding}
		<h3>{finding.title}</h3>
		<p class="detail">{finding.detail}</p>
		<div class="graph">
			{#if evidence?.kind === 'effects'}
				<EffectBars effects={evidence.effects} />
			{:else if evidence?.kind === 'contrast'}
				<IntervalPlot arms={evidence.arms} />
			{:else if evidence?.kind === 'landscape'}
				<LandscapeStrip
					band={evidence.band}
					axisLabel={evidence.axisLabel}
					format={axisFormat(evidence.axisKey)}
					cliffX={evidence.cliffX}
				/>
			{:else if evidence?.kind === 'curve'}
				<LearningCurve curve={evidence.curve} />
			{:else if evidence?.kind === 'behavior'}
				<BehaviorBars metrics={evidence.metrics} />
			{/if}
		</div>
	{:else}
		<p class="prompt">
			Not answered yet — run <b>{section.producer}</b> and add it to the report to settle this.
		</p>
	{/if}
</section>

<style>
	.qsec {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.qlabel {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: var(--sp-3);
		font-size: var(--fs-eyebrow);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		font-weight: var(--fw-semibold);
	}

	.qnum {
		color: var(--ink);
	}

	.qtitle {
		color: var(--ink3);
	}

	.qsrc {
		margin-left: auto;
		color: var(--ink3);
		text-transform: none;
		letter-spacing: normal;
	}

	h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-tight);
		color: var(--ink);
	}

	.detail {
		margin: 0;
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.graph {
		margin-top: var(--sp-2);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
		padding: var(--sp-5);
	}

	.prompt {
		margin: 0;
		padding: var(--sp-5);
		border: 1px dashed var(--line);
		border-radius: var(--radius-card);
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.prompt b {
		color: var(--ink2);
		font-weight: var(--fw-semibold);
	}
</style>
