<!--
  The Report — the seven-question brief, assembled from the notebook and laid out as a scientific paper
  that writes itself. A coverage spine on the left makes the honesty rail visible and navigates; the
  brief on the right leads with the strongest REAL finding, an auto-composed abstract (real numbers,
  never invented), then each question as a collapsible section with its numbered figure, the tensions
  the findings are in, the kept negatives, and a reproduce-this method.

  Reading modes and the skeptic toggles are the only local state; everything scientific is derived from
  the report store, whose honesty rail is untouched — a question reads answered ONLY when a finding
  backs it, and the abstract composes from those findings alone.
-->
<script lang="ts">
	import { SvelteSet, SvelteMap } from 'svelte/reactivity';
	import { report, app, findings } from '$lib/state';
	import { negativesOf } from '$lib/state';
	import type { ReportSection } from '$lib/state';
	import { QUESTIONS, type QuestionId } from '$lib/lab/questions';
	import CoverageSpine from './CoverageSpine.svelte';
	import Abstract from './Abstract.svelte';
	import QuestionSection from './QuestionSection.svelte';
	import TensionCallout from './TensionCallout.svelte';
	import ReproducePanel from './ReproducePanel.svelte';
	import ConfirmDialog from '../../common/ConfirmDialog.svelte';

	// The detailed sections are Q1–Q5; Q6 (negatives) and Q7 (method) render as their own panels.
	const DETAILED: QuestionId[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'];

	const sections = $derived(report.sections);
	const detailed = $derived(sections.filter((s) => DETAILED.includes(s.question.id)));
	const q6 = $derived(sections.find((s) => s.question.id === 'Q6')!);
	const abstract = $derived(report.abstract);
	const tensions = $derived(report.tensions);
	const coverage = $derived(report.coverage);
	const lead = $derived(report.lead);
	const reproduce = $derived(report.reproduce);
	const negatives = $derived(negativesOf(q6.finding));

	// A figure number for each detailed section that draws a graph, in question order — so the paper's
	// figures are numbered 1, 2, 3, … and an unanswered question takes no number.
	const figureNumbers = $derived.by(() => {
		const map = new SvelteMap<QuestionId, number>();
		let n = 0;
		for (const s of detailed) if (s.finding?.evidence) map.set(s.question.id, ++n);
		return map;
	});

	// ---- reading state: the three modes, the skeptic toggles, and which sections are open ----
	type Mode = 'brief' | 'full' | 'referee';
	let mode = $state<Mode>('full');
	let intervals = $state(true);
	let showData = $state(false);
	const openSet = new SvelteSet<QuestionId>(QUESTIONS.map((q) => q.id));
	let activeQ = $state<QuestionId | null>(null);

	function applyMode(next: Mode): void {
		mode = next;
		openSet.clear();
		if (next !== 'brief') for (const q of QUESTIONS) openSet.add(q.id);
		intervals = true;
		showData = next === 'referee';
	}

	function toggleSection(id: QuestionId): void {
		if (openSet.has(id)) openSet.delete(id);
		else openSet.add(id);
	}

	/** Jump to a question — open it, mark it active, and scroll it into view. Shared by the spine, the
	 *  abstract citations, and the tension refs, so every "go to Q…" is one path. */
	function jump(id: QuestionId): void {
		openSet.add(id);
		activeQ = id;
		document.getElementById(`report-${id.toLowerCase()}`)?.scrollIntoView({
			behavior: 'smooth',
			block: 'start'
		});
	}

	// ---- un-answering a question: confirm, then drop the finding that backs it ----
	// The section awaiting confirmation, or null. A finding can answer two questions (the Sweep settles
	// Q2 AND Q6), so removing it clears both — the confirm names the sibling so that is never a surprise.
	let pendingRemoval = $state<ReportSection | null>(null);

	const SHORT = new Map(QUESTIONS.map((q) => [q.id, q.short]));

	/** The questions the pending finding ALSO answers, besides the one clicked — for the warning line. */
	const alsoClears = $derived(
		(pendingRemoval?.finding?.questions ?? []).filter((id) => id !== pendingRemoval?.question.id)
	);

	const removalMessage = $derived.by(() => {
		if (!pendingRemoval) return '';
		const q = pendingRemoval.question.id;
		const base = `Remove the answer to ${q} (${pendingRemoval.question.short})? The section reverts to its prompt so you can run the test again.`;
		if (!alsoClears.length) return base;
		const siblings = alsoClears.map((id) => `${id} (${SHORT.get(id)})`).join(', ');
		return `${base} This is one finding that also answers ${siblings}, so it clears too.`;
	});

	function confirmRemoval(): void {
		if (pendingRemoval?.finding) findings.remove(pendingRemoval.finding.id);
		pendingRemoval = null;
	}
</script>

<div class="report" data-testid="report" data-print-region>
	<div class="layout">
		<CoverageSpine {sections} active={activeQ} onjump={jump} />

		<div class="brief">
			<!-- toolbar: reading modes · skeptic toggles · exports -->
			<div class="toolbar">
				<div class="seg" role="group" aria-label="reading mode">
					<button class:on={mode === 'brief'} onclick={() => applyMode('brief')}>Brief</button>
					<button class:on={mode === 'full'} onclick={() => applyMode('full')}>Full</button>
					<button class:on={mode === 'referee'} onclick={() => applyMode('referee')}>Referee</button
					>
				</div>
				<label class="tog">
					<input type="checkbox" bind:checked={intervals} data-testid="report-tog-intervals" />
					95% intervals
				</label>
				<label class="tog">
					<input type="checkbox" bind:checked={showData} data-testid="report-tog-data" />
					show data
				</label>
				<span class="hint">export &amp; reproduce in the sidebar →</span>
			</div>

			<!-- masthead: the thesis leads with the strongest real finding, never a fabricated one -->
			<header class="masthead">
				<span class="eyebrow">Synthesis · {report.subjectName} · seven questions</span>
				<h2>{lead ? lead.title : `${report.subjectName} hasn't been studied yet.`}</h2>
			</header>

			{#if abstract.length}
				<Abstract
					clauses={abstract}
					answered={coverage.answered}
					total={coverage.total}
					onjump={jump}
				/>
			{:else}
				<p class="lede">
					Run the instruments and "add to report", and the seven questions fill in here — each
					answer traced to the test that produced it, none of them invented.
				</p>
			{/if}

			{#each detailed as section (section.question.id)}
				<QuestionSection
					{section}
					figureNumber={figureNumbers.get(section.question.id)}
					open={openSet.has(section.question.id)}
					{intervals}
					{showData}
					ontoggle={() => toggleSection(section.question.id)}
					onremove={section.finding ? () => (pendingRemoval = section) : undefined}
				/>
			{/each}

			{#each tensions as tension, i (tension.id)}
				<TensionCallout {tension} index={i + 1} onjump={jump} />
			{/each}

			<!-- Q6 · what did not work — the kept negatives, first-class -->
			<aside class="negatives" id="report-q6" data-testid="report-qQ6">
				<h3>What did not work — and that's the finding</h3>
				{#if negatives.length}
					<p>
						<b>{negatives.join(', ')}</b> don't clear zero — the Sweep keeps them as real negatives, not
						an embarrassment to hide. More senses is not more survival.
					</p>
					<div class="negrow">
						{#each negatives as neg (neg)}<span class="neg">{neg}</span>{/each}
					</div>
				{:else if q6.finding}
					<p>Every factor the Sweep measured moved survival — no kept negatives this time.</p>
				{:else}
					<p>
						No negatives recorded yet — run <b>{q6.producer}</b> to find what a knob does NOT buy.
					</p>
				{/if}
			</aside>

			<!-- Q7 · reproduce this -->
			{#if reproduce}
				<ReproducePanel
					config={app.base}
					configHash={reproduce.configHash}
					seeds={reproduce.seeds}
					configJson={reproduce.configJson}
					onload={() => report.watch()}
				/>
			{:else}
				<footer class="method" id="report-q7" data-testid="report-qQ7">
					<b>Method.</b> No runs recorded yet — the provenance that reproduces a result appears here once
					a finding is added.
				</footer>
			{/if}
		</div>
	</div>
</div>

<ConfirmDialog
	open={pendingRemoval !== null}
	title="Remove this answer?"
	message={removalMessage}
	confirmLabel="Remove answer"
	confirmTestid="confirm-remove"
	onconfirm={confirmRemoval}
	oncancel={() => (pendingRemoval = null)}
/>

<style>
	.report {
		width: 100%;
		max-width: 1080px;
		margin: 0 auto;
	}

	.layout {
		display: grid;
		grid-template-columns: 200px minmax(0, 1fr);
		gap: var(--sp-6);
		align-items: start;
	}

	/* The spine tracks the page as the brief scrolls — the coverage ring and nav stay in reach. */
	.layout > :global(.spine) {
		position: sticky;
		top: var(--sp-4);
	}

	.brief {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
		min-width: 0;
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		flex-wrap: wrap;
		padding-bottom: var(--sp-4);
		border-bottom: 1px solid var(--line);
	}

	.seg {
		display: flex;
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		overflow: hidden;
	}

	.seg button {
		border: 0;
		background: none;
		color: var(--ink3);
		font: inherit;
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		padding: var(--sp-1) var(--sp-3);
		cursor: pointer;
	}

	.seg button.on {
		background: var(--panel2);
		color: var(--ink);
	}

	.tog {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		font-size: var(--fs-xs);
		color: var(--ink3);
		cursor: pointer;
		user-select: none;
	}

	.tog input {
		accent-color: var(--ink);
	}

	.hint {
		margin-left: auto;
		font-size: var(--fs-xs);
		color: var(--ink3);
	}

	.masthead {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.masthead h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-report-headline);
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

	.negatives {
		border: 1px solid var(--line);
		border-left: 3px solid var(--data-coral);
		background: color-mix(in oklab, var(--data-coral) 6%, transparent);
		border-radius: 0 var(--radius-card) var(--radius-card) 0;
		padding: var(--sp-5);
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		scroll-margin-top: var(--sp-4);
	}

	.negatives h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: var(--fw-semibold);
		color: var(--ink);
	}

	.negatives p {
		margin: 0;
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink2);
		max-width: 68ch;
	}

	.negatives b {
		color: var(--ink);
		font-weight: var(--fw-semibold);
	}

	.negrow {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2);
	}

	.neg {
		font-size: var(--fs-xs);
		border: 1px solid color-mix(in srgb, var(--data-coral) 40%, transparent);
		color: var(--data-coral);
		border-radius: var(--radius-chip);
		padding: 2px 8px;
		font-variant-numeric: tabular-nums;
	}

	.method {
		padding-top: var(--sp-5);
		border-top: 1px solid var(--line);
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
		scroll-margin-top: var(--sp-4);
	}

	.method b {
		color: var(--ink2);
		font-weight: var(--fw-semibold);
	}

	/* Below the spine's comfortable width, it drops above the brief as a horizontal strip. */
	@media (max-width: 720px) {
		.layout {
			grid-template-columns: 1fr;
		}

		.layout > :global(.spine) {
			position: static;
		}
	}
</style>
