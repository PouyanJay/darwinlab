<!--
  The console's right zone: context for whatever the workspace is showing.

  A thin switch, one panel per instrument — the Atlas's drilled point (the DrillCard, or an empty
  prompt), the Sweep's run summary, the Ledger's claim summary. Each panel is its own component that
  reads its own store, so they grow independently in later phases without this file changing for
  unrelated reasons. A `complementary` landmark, since it is supporting context beside the workspace.
-->
<script lang="ts">
	import DrillCard from './Atlas/DrillCard.svelte';
	import LandscapeSummary from './Atlas/LandscapeSummary.svelte';
	import SweepSummary from './Sweep/SweepSummary.svelte';
	import ClaimSummary from './Ledger/ClaimSummary.svelte';
	import { landscape } from '$lib/state';
	import type { Instrument } from './instruments';

	let { active }: { active: Instrument } = $props();

	const hasField = $derived(landscape.field !== null);
	const drilled = $derived(landscape.selected !== null && landscape.field !== null);
</script>

<aside class="sidebar" data-testid="research-sidebar" aria-label="research context">
	{#if active === 'atlas'}
		{#if hasField}
			<LandscapeSummary />
			{#if drilled}
				<DrillCard />
			{:else}
				<p class="empty">Click a cell on the map to open its world here — the door into Studio.</p>
			{/if}
		{:else}
			<div class="panel">
				<span class="eyebrow">This landscape</span>
				<p class="empty">Run a landscape — its threshold and drilled worlds appear here.</p>
			</div>
		{/if}
	{:else if active === 'sweep'}
		<SweepSummary />
	{:else if active === 'ledger'}
		<ClaimSummary />
	{/if}
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		min-height: 0;
		overflow-y: auto;
		padding: var(--sp-6) var(--sp-5);
		background: var(--panel);
		border-left: 1px solid var(--line);
	}

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

	.empty {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}
</style>
