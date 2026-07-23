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
	import TraceSummary from './Trace/TraceSummary.svelte';
	import ReportContents from './Report/ReportContents.svelte';
	import SummaryPanel from './SummaryPanel.svelte';
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
			<SummaryPanel
				eyebrow="This landscape"
				empty="Run a landscape — its threshold and drilled worlds appear here."
			/>
		{/if}
	{:else if active === 'sweep'}
		<SweepSummary />
	{:else if active === 'ledger'}
		<ClaimSummary />
	{:else if active === 'trace'}
		<TraceSummary />
	{:else if active === 'report'}
		<ReportContents />
	{/if}
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		min-height: 0;
		overflow-y: auto;
		/* Zones scroll in place, chrome-free — see the rail's note; the mock is the contract. */
		scrollbar-width: none;
		padding: var(--sp-6) var(--sp-5);
		background: var(--panel);
		border-left: 1px solid var(--line);
	}

	.sidebar::-webkit-scrollbar {
		display: none;
	}

	/* The one bit of prose the sidebar renders itself — the hint to drill a cell (the panels are their
	   own components now). */
	.empty {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}
</style>
