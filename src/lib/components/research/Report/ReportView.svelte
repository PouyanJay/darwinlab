<!--
  The Report — the seven-question brief, assembled from the notebook for the current subject. It leads
  with the strongest REAL finding (never a fabricated thesis), states honestly how much is answered,
  lays the seven out at a glance, then takes each in turn: a graph drawn from the finding's evidence, or
  a prompt to run the test that would answer it. Q6 keeps the negatives; Q7 always states the method.
-->
<script lang="ts">
	import { report, negativesOf } from '$lib/state';
	import type { QuestionId } from '$lib/lab/questions';
	import AnswersTable from './AnswersTable.svelte';
	import QuestionSection from './QuestionSection.svelte';

	// Q6 (the negatives note) and Q7 (the method footer) are rendered specially below, not as graph
	// sections — the rest (Q1–Q5) each get a detailed QuestionSection.
	const SPECIAL_SECTIONS: QuestionId[] = ['Q6', 'Q7'];

	const sections = $derived(report.sections);
	const detailed = $derived(sections.filter((s) => !SPECIAL_SECTIONS.includes(s.question.id)));
	const q6 = $derived(sections.find((s) => s.question.id === 'Q6')!);
	const lead = $derived(report.lead);
	const coverage = $derived(report.coverage);
	const method = $derived(report.method);

	/** The Sweep's kept negatives — the factors whose interval can't clear zero (what did NOT work). */
	const negatives = $derived(negativesOf(q6.finding));
</script>

<article class="report" data-testid="report">
	<p class="eyebrow">Synthesis · {report.subjectName} · seven questions</p>
	<h2 class="headline">
		{lead ? lead.title : `${report.subjectName} hasn't been studied yet.`}
	</h2>
	<p class="lede">
		{#if report.hasFindings}
			<b>{coverage.answered} of the seven</b> questions a rigorous study must answer are settled for this
			subject; the rest are waiting on a test. Every answer below is traced to the test that produced
			it.
		{:else}
			Run the instruments and "add to report", and the seven questions fill in here — each answer
			traced to the test that produced it, none of them invented.
		{/if}
	</p>

	<section class="glance">
		<AnswersTable {sections} />
	</section>

	{#each detailed as section (section.question.id)}
		<QuestionSection {section} />
	{/each}

	<!-- Q6 · what did not work — the kept negatives, as a note, not a graph. -->
	<aside class="note" data-testid="report-qQ6">
		<h3>What did not work</h3>
		{#if negatives.length}
			<p>
				<b>{negatives.join(', ')}</b> don't clear zero — the Sweep keeps them as real negatives, not an
				embarrassment to hide. More knobs is not more survival.
			</p>
		{:else if q6.finding}
			<p>Every factor the Sweep measured moved survival — no kept negatives this time.</p>
		{:else}
			<p>No negatives recorded yet — run <b>{q6.producer}</b> to find what a knob does NOT buy.</p>
		{/if}
	</aside>

	<!-- Q7 · can anyone re-run it — the method footer, always present. -->
	<footer class="method" data-testid="report-qQ7">
		{#if method}
			<b>Method.</b> Reproducible: config <b class="tabular">{method.configHash}</b>, {method.seeds} seeds
			per arm. Seeded runs re-run identical.
		{:else}
			<b>Method.</b> No runs recorded yet — the provenance that reproduces a result appears here once
			a finding is added.
		{/if}
	</footer>
</article>

<style>
	.report {
		width: 100%;
		max-width: 760px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
	}

	.eyebrow {
		margin: 0;
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.headline {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-report-headline, 26px);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-tight);
		line-height: 1.12;
		color: var(--ink);
		text-wrap: balance;
	}

	.lede {
		margin: 0;
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink2);
		max-width: 62ch;
	}

	.lede b {
		color: var(--ink);
		font-weight: var(--fw-semibold);
	}

	.glance {
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
		padding: var(--sp-5);
	}

	.note {
		border-left: 3px solid var(--data-teal);
		background: color-mix(in oklab, var(--data-teal) 6%, transparent);
		border-radius: 0 var(--radius-card) var(--radius-card) 0;
		padding: var(--sp-5);
	}

	.note h3 {
		margin: 0 0 var(--sp-3);
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: var(--fw-semibold);
		color: var(--ink);
	}

	.note p {
		margin: 0;
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink2);
		max-width: 68ch;
	}

	.note b {
		color: var(--ink);
		font-weight: var(--fw-semibold);
	}

	.method {
		padding-top: var(--sp-5);
		border-top: 1px solid var(--line);
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
		max-width: 72ch;
	}

	.method b {
		color: var(--ink2);
		font-weight: var(--fw-semibold);
	}
</style>
