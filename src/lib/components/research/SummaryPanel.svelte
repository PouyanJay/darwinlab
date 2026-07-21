<!--
  The shared shell for the right-sidebar summaries (the Sweep's run, the Ledger's claim, the Atlas's
  landscape). It owns the common shape — an eyebrow, a lead headline card, a two-up stat grid, an
  empty prompt — so each summary supplies only its own data and its footer (the notes + the "add to
  report" button, passed as children). One place for the panel's look, so a fourth instrument reuses
  it rather than copying it a fourth time.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Stat {
		label: string;
		value: string;
	}

	let {
		eyebrow,
		title,
		detail,
		/** The lead headline in the display face (the Ledger's claim text), not the default stat face. */
		display = false,
		stats = [],
		/** Shown when there is nothing measured yet — the honest "run the instrument" prompt. */
		empty,
		children
	}: {
		eyebrow: string;
		title?: string;
		detail?: string;
		display?: boolean;
		stats?: Stat[];
		empty?: string;
		children?: Snippet;
	} = $props();
</script>

<div class="panel">
	<span class="eyebrow">{eyebrow}</span>

	{#if title}
		<div class="lead">
			<b class:display>{title}</b>
			{#if detail}<span>{detail}</span>{/if}
		</div>
	{/if}

	{#if stats.length}
		<dl class="statgrid">
			{#each stats as stat (stat.label)}
				<div>
					<dt>{stat.label}</dt>
					<dd class="tabular">{stat.value}</dd>
				</div>
			{/each}
		</dl>
	{/if}

	{#if empty}<p class="empty">{empty}</p>{/if}

	{@render children?.()}
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

	.lead {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--panel2);
	}

	.lead b {
		font-size: var(--fs-title);
		font-weight: var(--fw-semibold);
		color: var(--ink);
		letter-spacing: var(--tracking-tight);
	}

	.lead b.display {
		font-family: var(--font-display);
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		letter-spacing: normal;
	}

	.lead span {
		font-size: var(--fs-sm);
		color: var(--ink3);
	}

	.statgrid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		margin: 0;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--line);
	}

	.statgrid > div {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--sp-3) var(--sp-4);
		background: var(--panel);
	}

	.statgrid dt {
		font-size: var(--fs-sm);
		color: var(--ink3);
	}

	.statgrid dd {
		margin: 0;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.empty {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}
</style>
