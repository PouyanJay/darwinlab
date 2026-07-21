<!--
  The Report's context in the console sidebar: the seven questions as a contents outline, each with a
  dot that fills once a finding answers it, and a count of what the brief is built from. Reads only the
  report store.
-->
<script lang="ts">
	import { report } from '$lib/state';

	const sections = $derived(report.sections);
	const n = $derived(report.findings.length);
</script>

<div class="panel">
	<span class="eyebrow">Contents</span>
	<ul class="toc">
		{#each sections as s (s.question.id)}
			<li class="item" class:answered={s.finding}>
				<span class="dot" aria-hidden="true"></span>
				<span class="q">{s.question.id} · {s.question.short}</span>
			</li>
		{/each}
	</ul>
	<p class="built">Built from {n} finding{n === 1 ? '' : 's'}.</p>
</div>

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

	.toc {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.item {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: 5px 2px;
	}

	.dot {
		flex: none;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: none;
		box-shadow: inset 0 0 0 1.5px var(--ink3);
	}

	.item.answered .dot {
		background: var(--ink2);
		box-shadow: none;
	}

	.q {
		font-size: var(--fs-sm);
		color: var(--ink3);
	}

	.item.answered .q {
		color: var(--ink2);
	}

	.built {
		margin: var(--sp-2) 0 0;
		font-size: var(--fs-sm);
		color: var(--ink3);
	}
</style>
