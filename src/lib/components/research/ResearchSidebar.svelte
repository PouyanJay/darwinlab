<!--
  The console's right zone: context for whatever the workspace is showing.

  A thin switch, one panel per instrument — the Atlas's and the Ledger's drilled records, the
  Sweep's run summary + drill (which carries the microscope, the behaviour trace folded in), the
  Report's contents. Each panel is its own component that reads its own store, so they grow
  independently in later phases without this file changing for unrelated reasons. A `complementary`
  landmark, since it is supporting context beside the workspace.
-->
<script lang="ts">
	import DrillCard from './Atlas/DrillCard.svelte';
	import SweepSummary from './Sweep/SweepSummary.svelte';
	import SweepDrillCard from './Sweep/SweepDrillCard.svelte';
	import LedgerDrillCard from './Ledger/LedgerDrillCard.svelte';
	import ReportContents from './Report/ReportContents.svelte';
	import { landscape, ledger, sweep } from '$lib/state';
	import type { Instrument } from './instruments';

	let { active }: { active: Instrument } = $props();

	const hasField = $derived(landscape.field !== null);
	const drilled = $derived(landscape.selected !== null && landscape.field !== null);

	// The sweep's drilled cell, resolved against the current grid — the store clears it on a new run.
	const sweepDrill = $derived.by(() => {
		const sel = sweep.selected;
		if (!sel || !sweep.results || !sweep.cells[sel.condition]) return null;
		return sel;
	});
</script>

<aside class="sidebar no-scrollbar" data-testid="research-sidebar" aria-label="research context">
	{#if active === 'atlas'}
		{#if drilled}
			<DrillCard />
		{:else if hasField}
			<p class="empty">Click a cell on the map to open its world here — the door into Studio.</p>
		{:else}
			<p class="empty">
				Paint a landscape and drill any cell — its place on the plane, its neighbours, and the door
				into Studio open here.
			</p>
		{/if}
	{:else if active === 'sweep'}
		<SweepSummary />
		{#if sweepDrill}
			<SweepDrillCard
				cell={sweep.cells[sweepDrill.condition]}
				conditionIndex={sweepDrill.condition}
				seed={sweepDrill.seed}
				evaluation={sweep.results?.[sweepDrill.condition] ?? null}
				allResults={sweep.results ?? []}
				championScored={sweep.receipt?.championOn ?? false}
				episodes={sweep.receipt?.episodes ?? 0}
				genDuration={sweep.receipt?.genDuration ?? 0}
				onclose={() => sweep.clearSelection()}
			/>
		{:else if sweep.results}
			<p class="empty">
				Click a cell of the run grid to open its world here — the door into Studio.
			</p>
		{/if}
	{:else if active === 'ledger'}
		{#if ledger.selected}
			<LedgerDrillCard />
		{:else}
			<p class="empty">
				Test a claim and its record opens here — the verdict's provenance, and the doors back into
				the composer.
			</p>
		{/if}
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
		overflow-y: auto; /* chrome-free via the shared .no-scrollbar utility */
		padding: var(--sp-6) var(--sp-5);
		background: var(--panel);
		border-left: 1px solid var(--line);
	}

	/* The sidebar is a FIXED-height flex column. A child with visible overflow can't shrink below its
	   content, but one that ever gains overflow:hidden becomes shrinkable — and this zone would then
	   compress it to fit instead of scrolling (the design mock's drill card clipped its microscope
	   exactly this way). Pin every child to its natural height; scrolling is the sidebar's job. */
	.sidebar > :global(*) {
		flex-shrink: 0;
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
