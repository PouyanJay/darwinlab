<!--
  One collapsible group of subject knobs — the disclosure shell the subject card's sections share
  (Population, Tank, Brain), extracted so the summary/chevron wiring exists once. Uncontrolled on
  purpose: `open` only seeds the initial state, the user's toggling is the browser's business.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		open = false,
		children
	}: { title: string; open?: boolean; children: Snippet } = $props();
</script>

<details class="grp" {open}>
	<summary
		><span class="eyebrow">{title}</span><span class="chev" aria-hidden="true">›</span></summary
	>
	<div class="grp-body">
		{@render children()}
	</div>
</details>

<style>
	.grp {
		border-top: 1px solid var(--line);
	}

	summary {
		list-style: none;
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--sp-3) 0;
		user-select: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.chev {
		color: var(--ink3);
		font-size: var(--fs-xs);
		transition: transform var(--dur-fast) var(--ease);
	}

	.grp[open] .chev {
		transform: rotate(90deg);
	}

	.grp-body {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding: 0 0 var(--sp-4);
	}
</style>
