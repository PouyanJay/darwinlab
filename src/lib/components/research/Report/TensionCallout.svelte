<!--
  A flagged tension — two findings that both stand but pull against each other, surfaced rather than
  averaged away. The store's `detectTensions` decides when one exists (only from real evidence); this
  component lays it out, and its "between … and …" line jumps to each finding's question.
-->
<script lang="ts">
	import type { Tension } from '$lib/report/compose';
	import type { QuestionId } from '$lib/lab/questions';

	let {
		tension,
		index,
		onjump
	}: {
		tension: Tension;
		/** 1-based position, so the callout reads "Tension 1", "Tension 2", …. */
		index: number;
		onjump: (id: QuestionId) => void;
	} = $props();
</script>

<div class="tension" data-testid="report-tension">
	<h4><span class="tnum">Tension {index}</span> {tension.title}</h4>
	<p>{tension.body}</p>
	<span class="pair">
		between
		{#each tension.between as ref, i (ref.questionId)}
			{#if i > 0}<span> and </span>{/if}
			<button class="ref" onclick={() => onjump(ref.questionId)}>
				{ref.questionId} · {ref.source}
			</button>
		{/each}
		· surfaced when two findings disagree
	</span>
</div>

<style>
	.tension {
		border: 1px solid color-mix(in srgb, var(--excite) 40%, transparent);
		border-left: 3px solid var(--excite);
		background: color-mix(in oklab, var(--excite) 7%, transparent);
		border-radius: 0 var(--radius-card) var(--radius-card) 0;
		padding: var(--sp-4) var(--sp-5);
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	h4 {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: var(--fw-semibold);
		color: var(--ink);
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}

	.tnum {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-bold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--excite);
		border: 1px solid color-mix(in srgb, var(--excite) 50%, transparent);
		border-radius: var(--radius-chip);
		padding: 1px 6px;
	}

	p {
		margin: 0;
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink2);
	}

	.pair {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.ref {
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		color: var(--excite);
		font: inherit;
		font-size: var(--fs-eyebrow);
	}

	.ref:hover {
		text-decoration: underline;
	}

	.ref:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}
</style>
