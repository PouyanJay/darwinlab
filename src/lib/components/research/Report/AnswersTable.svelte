<!--
  The seven questions at a glance — the answer, and the test it came from, in one row each. An answered
  question shows the finding's own words; an unanswered one says "Not tested" against a muted dot. The
  dot is the one place colour is data: teal for a positive result, coral for a kept negative.
-->
<script lang="ts">
	import { SOURCE_LABEL } from '$lib/lab/questions';
	import type { ReportSection } from '$lib/state';

	let { sections }: { sections: ReportSection[] } = $props();
</script>

<!-- The answer column reads `section.answer` (question-aware: Q7 the method, Q6 the negatives), so
     no row shows a conclusion that isn't the answer to its own question. -->

<table class="answers">
	<caption>The seven questions a rigorous study must answer</caption>
	<thead>
		<tr>
			<th scope="col" class="qn">#</th>
			<th scope="col">Question</th>
			<th scope="col">Answer</th>
			<th scope="col" class="src">Source</th>
		</tr>
	</thead>
	<tbody>
		{#each sections as s (s.question.id)}
			<tr>
				<th scope="row" class="qn">{s.question.id}</th>
				<td class="q">{s.question.title}</td>
				<td class="a">
					{#if s.finding}
						<span
							class="dot"
							class:ok={s.finding.status === 'ok'}
							class:limit={s.finding.status === 'limit'}
							aria-hidden="true"
						></span>
						{s.answer}
					{:else}
						<span class="dot" aria-hidden="true"></span>
						<span class="untested">Not tested</span>
					{/if}
				</td>
				<td class="src">{s.finding ? SOURCE_LABEL[s.finding.source] : '—'}</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.answers {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--fs-body);
	}

	caption {
		text-align: left;
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
		padding-bottom: var(--sp-3);
	}

	th,
	td {
		text-align: left;
		padding: var(--sp-3) var(--sp-4);
		border-bottom: 1px solid var(--line);
		vertical-align: baseline;
	}

	thead th {
		font-size: var(--fs-eyebrow);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
		font-weight: var(--fw-semibold);
	}

	.qn {
		width: 2.5em;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.q {
		color: var(--ink3);
	}

	.a {
		color: var(--ink);
	}

	.a .untested {
		color: var(--ink3);
	}

	.src {
		color: var(--ink3);
		white-space: nowrap;
	}

	.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		margin-right: 7px;
		background: none;
		box-shadow: inset 0 0 0 1.5px var(--ink3);
		vertical-align: middle;
	}

	/* Colour is data here: a positive result is teal, a kept negative coral. */
	.dot.ok {
		background: var(--data-teal);
		box-shadow: none;
	}

	.dot.limit {
		background: var(--data-coral);
		box-shadow: none;
	}

	@media (max-width: 620px) {
		.src {
			display: none;
		}
	}
</style>
