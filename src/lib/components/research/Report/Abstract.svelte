<!--
  The auto-composed abstract — a few sentences read from the settled findings, each closing with a
  citation that jumps to the question it came from, and an honest gold clause naming the first gap.

  It renders `report.abstract` verbatim: the composition (and its honesty) lives in the store's pure
  `composeAbstract`, so this component only lays the clauses out and wires the citations. Nothing here
  is authored — an empty abstract simply renders nothing, and the Report shows its "not studied yet"
  lede instead.
-->
<script lang="ts">
	import type { AbstractClause } from '$lib/report/compose';
	import type { QuestionId } from '$lib/lab/questions';

	let {
		clauses,
		answered,
		total,
		onjump
	}: {
		clauses: AbstractClause[];
		answered: number;
		total: number;
		onjump: (id: QuestionId) => void;
	} = $props();

	/** The punctuation after a clause: a full stop closes the abstract, a space precedes the gold gap
	 *  clause (which reads as its own sentence), and a semicolon joins the rest. */
	function separatorAfter(clause: AbstractClause, index: number): string {
		if (index === clauses.length - 1) return '.';
		return clause.gap ? ' ' : '; ';
	}
</script>

<div class="abstract" data-testid="report-abstract">
	<div class="lab">
		<span class="eyebrow">Abstract</span>
		<span class="auto">assembled from findings — never authored</span>
	</div>
	<p>
		{#each clauses as clause, i (i)}<span class:gap={clause.gap}
				>{clause.text}{#if clause.questionId}<button
						class="cite"
						onclick={() => onjump(clause.questionId!)}
						aria-label="jump to {clause.questionId}">{clause.questionId}</button
					>{/if}</span
			>{separatorAfter(clause, i)}{/each}
	</p>
	<span class="band">
		{answered} of {total} questions settled for this subject · every clause links to the run that produced
		it
	</span>
</div>

<style>
	.abstract {
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
		padding: var(--sp-5) var(--sp-5) var(--sp-4);
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.lab {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--gold-ink);
	}

	.auto {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
		border: 1px solid var(--line);
		border-radius: var(--radius-chip);
		padding: 1px 6px;
	}

	/* A serif reading face sets the abstract apart as the paper's spoken summary — the one place the
	   Report leans literary. The UI everywhere else stays in the sans display/ui faces. */
	p {
		margin: 0;
		font-family: Georgia, 'Times New Roman', 'Iowan Old Style', serif;
		font-size: 15.5px;
		line-height: 1.6;
		color: var(--ink);
	}

	/* The gap clause is the honest closer — gold, so it reads as "and this is missing", not a finding. */
	.gap {
		color: var(--gold-ink);
	}

	.cite {
		background: none;
		border: 0;
		padding: 0 0 0 2px;
		cursor: pointer;
		color: var(--data-teal);
		font-family: var(--font);
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-bold);
		vertical-align: super;
	}

	.cite:hover {
		text-decoration: underline;
	}

	.cite:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
		border-radius: var(--radius-chip);
	}

	.band {
		font-size: var(--fs-xs);
		color: var(--ink3);
	}
</style>
