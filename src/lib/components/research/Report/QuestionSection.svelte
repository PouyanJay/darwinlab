<!--
  One question's section in the Report — a collapsible row. The head always shows the question, its
  one-line answer (the finding's own words, never invented), and a drill-through link back to the
  instrument that produced it; expanding reveals the numbered figure drawn from the evidence, and a
  caveat. When nothing answers it, it says so plainly and offers to run the test that would — no
  placeholder graph, no fabricated verdict.

  The skeptic props (intervals, showData) ride down to the viz so the Report's toolbar can add the 95%
  intervals and open the data tables across every figure at once.
-->
<script lang="ts">
	import EffectBars from '../viz/EffectBars.svelte';
	import IntervalPlot from '../viz/IntervalPlot.svelte';
	import LandscapeStrip from '../viz/LandscapeStrip.svelte';
	import LearningCurve from '../viz/LearningCurve.svelte';
	import BehaviorBars from '../viz/BehaviorBars.svelte';
	import { CANDIDATE_AXES } from '$lib/lab/landscape';
	import { SOURCE_LABEL, type FindingSource, type ResearchInstrument } from '$lib/lab/questions';
	import { app } from '$lib/state';
	import type { ReportSection } from '$lib/state';

	let {
		section,
		figureNumber,
		open,
		intervals,
		showData,
		ontoggle
	}: {
		section: ReportSection;
		/** The figure's number in the paper, or undefined when this section draws no figure. */
		figureNumber?: number;
		open: boolean;
		intervals: boolean;
		showData: boolean;
		ontoggle: () => void;
	} = $props();

	const finding = $derived(section.finding);
	const evidence = $derived(finding?.evidence);

	/** Which instrument a finding's source drills back to — a trace lives in the Sweep drill's
	 *  microscope, so its link lands on the Sweep. */
	const SOURCE_INSTRUMENT: Record<FindingSource, ResearchInstrument> = {
		sweep: 'sweep',
		ledger: 'ledger',
		atlas: 'atlas',
		trace: 'sweep'
	};

	/** The instrument that WOULD answer an unanswered question — read from its producer name, so the
	 *  "run …" button lands on the right rail tab. Falls back to the Sweep. */
	function fallbackSource(producer: string): FindingSource {
		const p = producer.toLowerCase();
		if (p.includes('ledger')) return 'ledger';
		if (p.includes('atlas')) return 'atlas';
		if (p.includes('trace')) return 'trace';
		return 'sweep';
	}

	/** The landscape axis's format fn, resolved from its persisted key (functions don't serialise). */
	const axisFormat = (key: string) =>
		CANDIDATE_AXES.find((a) => a.key === key)?.format ?? ((v: number) => String(v));
</script>

<section
	class="qsec"
	class:open
	data-testid="report-q{section.question.id}"
	id="report-{section.question.id.toLowerCase()}"
>
	<div class="head">
		<button class="toggle" onclick={ontoggle} aria-expanded={open}>
			<span class="qk">{section.question.id}</span>
			<span class="qmain">
				<span class="qtitle">{section.question.title}</span>
				{#if finding}
					<span class="answer">{section.answer}</span>
				{:else}
					<span class="answer untested">Not answered yet — nothing has settled this.</span>
				{/if}
			</span>
			<span class="chev" aria-hidden="true">›</span>
		</button>
		{#if finding}
			<button
				class="src"
				onclick={() => app.setInstrument(SOURCE_INSTRUMENT[finding.source])}
				title="drill back to {SOURCE_LABEL[finding.source]}"
			>
				← {SOURCE_LABEL[finding.source]}
			</button>
		{:else}
			<span class="src gap">not tested</span>
		{/if}
	</div>

	{#if open}
		<div class="body">
			{#if finding}
				{#if figureNumber !== undefined && evidence}
					<div class="figure">
						<div class="figcap">
							<b>Figure {figureNumber}</b>
							· {finding.detail}
						</div>
						{#if evidence.kind === 'effects'}
							<EffectBars effects={evidence.effects} {intervals} open={showData} />
						{:else if evidence.kind === 'contrast'}
							<IntervalPlot arms={evidence.arms} {intervals} open={showData} />
						{:else if evidence.kind === 'landscape'}
							<LandscapeStrip
								band={evidence.band}
								axisLabel={evidence.axisLabel}
								format={axisFormat(evidence.axisKey)}
								cliffX={evidence.cliffX}
								open={showData}
							/>
						{:else if evidence.kind === 'curve'}
							<LearningCurve curve={evidence.curve} open={showData} />
						{:else if evidence.kind === 'behavior'}
							<BehaviorBars metrics={evidence.metrics} open={showData} />
						{/if}
					</div>
				{:else}
					<p class="detail">{finding.detail}</p>
				{/if}
			{:else}
				<div class="gap-card">
					<p>
						The Report states this <b>only</b> once a real finding backs it — no placeholder verdict.
					</p>
					<button
						class="run"
						onclick={() => app.setInstrument(SOURCE_INSTRUMENT[fallbackSource(section.producer)])}
					>
						Run {section.producer} →
					</button>
				</div>
			{/if}
		</div>
	{/if}
</section>

<style>
	.qsec {
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--line);
		scroll-margin-top: var(--sp-4);
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: var(--sp-3);
		padding: var(--sp-4) 0 var(--sp-3);
	}

	.toggle {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: baseline;
		gap: var(--sp-3);
		background: none;
		border: 0;
		padding: 0;
		text-align: left;
		cursor: pointer;
		color: inherit;
		font: inherit;
	}

	.toggle:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
		border-radius: var(--radius-chip);
	}

	.qk {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-bold);
		letter-spacing: var(--tracking-wide);
		color: var(--ink3);
		min-width: 26px;
		padding-top: 2px;
	}

	.qmain {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.qtitle {
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-tight);
		color: var(--ink);
	}

	.answer {
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink2);
	}

	.answer.untested {
		color: var(--ink3);
	}

	/* a button styled as the drill-through link — its own tab stop, beside the toggle (never nested). */
	.src {
		flex: none;
		font-size: var(--fs-eyebrow);
		color: var(--data-teal);
		white-space: nowrap;
		background: none;
		border: 0;
		border-bottom: 1px solid color-mix(in srgb, var(--data-teal) 40%, transparent);
		padding: 3px 0 0;
		cursor: pointer;
		font-family: inherit;
	}

	.src:hover {
		border-bottom-color: var(--data-teal);
	}

	.src:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	.src.gap {
		color: var(--gold-ink);
		border: 0;
		cursor: default;
	}

	.chev {
		margin-left: auto;
		color: var(--ink3);
		font-size: var(--fs-md);
		transition: transform var(--dur-fast) var(--ease);
	}

	.qsec.open .chev {
		transform: rotate(90deg);
	}

	.body {
		padding: 0 0 var(--sp-4) calc(26px + var(--sp-3));
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}

	.figure {
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
		padding: var(--sp-4) var(--sp-5);
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.figcap {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}

	.figcap b {
		color: var(--ink2);
		font-weight: var(--fw-bold);
	}

	.detail {
		margin: 0;
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.gap-card {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		border: 1px dashed color-mix(in srgb, var(--gold-ink) 40%, transparent);
		background: color-mix(in oklab, var(--gold-ink) 5%, transparent);
		border-radius: var(--radius-card);
		padding: var(--sp-4) var(--sp-5);
	}

	.gap-card p {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ink2);
	}

	.gap-card b {
		color: var(--ink);
	}

	.run {
		margin-left: auto;
		white-space: nowrap;
		border: 1px solid var(--gold-ink);
		color: var(--gold-ink);
		background: none;
		border-radius: var(--radius-control);
		font: inherit;
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		padding: var(--sp-1) var(--sp-3);
		cursor: pointer;
	}

	.run:hover {
		background: color-mix(in oklab, var(--gold-ink) 12%, transparent);
	}
</style>
