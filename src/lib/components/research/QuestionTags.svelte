<!--
  The "answers Q…" tags — which of the seven questions an instrument settles, shown as small outline
  chips under its name in the rail and beside its title in the workspace header. Monochrome on purpose:
  they read through ink and a border, never a colour (teal and coral are reserved for the graphs).

  Two aria modes. In the rail each tag sits INSIDE a `role="tab"` button, whose accessible name is
  computed from its contents — so there the chips are `decorative` (aria-hidden), keeping the tab named
  plainly "The Sweep" for the keyboard nav and the selectors that drive it. In the header they stand on
  their own, so the group carries a spoken label ("answers Q2, Q6") and the chips stay decorative within
  it — a screen reader hears the summary once, not each token in turn.
-->
<script lang="ts">
	import { QUESTIONS, type QuestionId } from '$lib/lab/questions';

	let { questions, decorative = false }: { questions: QuestionId[]; decorative?: boolean } =
		$props();

	/** The full question behind a tag — its title is the chip's tooltip, its short the spoken label. */
	function question(id: QuestionId) {
		return QUESTIONS.find((q) => q.id === id);
	}

	// The spoken summary for the non-decorative (header) case: "answers Q2, Q6".
	const label = $derived(`answers ${questions.join(', ')}`);
</script>

{#if questions.length}
	<span
		class="qtags"
		role={decorative ? undefined : 'group'}
		aria-hidden={decorative ? 'true' : undefined}
		aria-label={decorative ? undefined : label}
	>
		{#each questions as id (id)}
			<span class="qtag" title={question(id)?.title}>{id}</span>
		{/each}
	</span>
{/if}

<style>
	.qtags {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 3px;
	}

	.qtag {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		color: var(--ink3);
		border: 1px solid var(--line);
		border-radius: var(--radius-chip);
		padding: 1px 5px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
</style>
