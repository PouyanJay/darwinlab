<!--
  The Report's context in the console sidebar: the seven questions as a contents outline, each with a
  dot that fills once a finding answers it, a count of what the brief is built from, and — once there is
  something to keep — the actions that take it elsewhere: export it as Markdown, print it (the browser's
  own "save as PDF"), or reopen its subject in Studio. Reads the report store; the actions are its own
  side effects (a download, a print, a hop to Studio).
-->
<script lang="ts">
	import { report } from '$lib/state';
	import { downloadText } from '$lib/download';
	import Button from '../../common/Button.svelte';

	const sections = $derived(report.sections);
	const n = $derived(report.findings.length);

	function exportMarkdown(): void {
		downloadText('darwin-lab-report.md', report.toMarkdown(), 'text/markdown');
	}
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

	{#if report.hasFindings}
		<div class="actions" data-testid="report-actions">
			<Button size="sm" variant="ghost" onclick={exportMarkdown} data-testid="export-md">
				Export Markdown
			</Button>
			<Button size="sm" variant="ghost" onclick={() => window.print()} data-testid="print-report">
				Print / Save PDF
			</Button>
			<Button size="sm" variant="ghost" onclick={() => report.watch()} data-testid="watch-subject">
				Watch in Studio
			</Button>
		</div>
	{/if}
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

	/* The actions sit under the outline, separated by a hairline — take the brief with you, or reopen
	   its subject in Studio. A wrapping column so each label stays whole in the narrow sidebar. */
	.actions {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		margin-top: var(--sp-4);
		padding-top: var(--sp-4);
		border-top: 1px solid var(--line);
	}

	.actions :global(.btn) {
		width: 100%;
	}
</style>
