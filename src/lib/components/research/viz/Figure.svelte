<!--
  The shared chrome every viz graph wears: the graphic as a labelled image (so a screen reader hears
  the conclusion, never a wall of SVG), and a collapsible "as a table" beneath it holding the raw
  numbers. Charts pass their SVG as `children` and their DataTable as the `table` snippet; the
  monochrome frame and the accessibility live here, once.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		children,
		table,
		open
	}: {
		/** The one-sentence conclusion a screen reader reads in place of the pixels. */
		label: string;
		children: Snippet;
		table: Snippet;
		/** Force the data table open — the Report's "show data" skeptic toggle drives this. Undefined
		 *  leaves it user-controlled (the per-figure summary), so ordinary callers are unaffected. */
		open?: boolean;
	} = $props();
</script>

<figure class="figure">
	<div class="graphic" role="img" aria-label={label}>
		{@render children()}
	</div>
	<details class="as-table" open={open || undefined}>
		<summary>Show as a table</summary>
		<div class="table-wrap">
			{@render table()}
		</div>
	</details>
</figure>

<style>
	.figure {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		min-width: 0;
	}

	.graphic {
		min-width: 0;
	}

	.as-table > summary {
		font-size: var(--fs-sm);
		color: var(--ink3);
		cursor: pointer;
		width: fit-content;
		list-style-position: inside;
	}

	.as-table > summary:hover {
		color: var(--ink);
	}

	.as-table > summary:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
		border-radius: var(--radius-chip);
	}

	.table-wrap {
		margin-top: var(--sp-3);
		overflow-x: auto;
	}
</style>
