<!--
  The Sweep instrument — factors in, effect sizes out.

  The DESIGN PANEL (the console's second sidebar) runs the grid; the workspace reports the results,
  layout by argument (the mock is the contract): the HONESTY TILES lead (the experiment's receipts —
  cells run vs planned, total runs, the frozen budget, the wall clock, the strongest effect), the
  ranked MAIN EFFECTS follow, and the raw run grid spans the FULL width beneath — it is the one
  clickable chart, so its cells get the room to be real targets. Until a run lands the workspace
  says plainly what to do. Everything reads off the sweep store; nothing measures here.
-->
<script lang="ts">
	import EffectBars from '../viz/EffectBars.svelte';
	import RunHeatmap from './RunHeatmap.svelte';
	import RunCellCard from './RunCellCard.svelte';
	import { sweep } from '$lib/state';
	import { toEffectRows } from '$lib/lab/sweep';
	import { rankEffectRows, strongestEffect } from '$lib/lab/evidence';
	import { formatSignedSeconds, formatWallClock } from '$lib/format';

	// RANKED by effect size, so the answer reads top-down (the mock's rule). NaN deltas (an arm with
	// no results) sink to the bottom rather than poisoning the sort.
	// RANKED by effect size, so the answer reads top-down (the mock's rule) — the shared sorter,
	// so the chart and any other consumer rank identically.
	const effectRows = $derived(rankEffectRows(toEffectRows(sweep.effects)));

	/** Rendered through an expression so the build can never collapse its spaces — as a literal text
	 *  node the production build shipped '2/ 2' once (and a string-literal mustache trips lint). */
	const CELLS_SEPARATOR = ' / ';

	/** The headline tile: the strongest factor whose interval CLEARS ZERO — the same isFlatEffect
	 *  test as the muted bars and the sidebar's lead, so the tile can never paint a confident colour
	 *  over a bar the card beneath it mutes. Null = a flat environment, itself a real result. */
	const strongest = $derived(strongestEffect(effectRows));

	// The drilled cell, resolved against the current grid — a full-width detail card renders below
	// the results. Selection is store-owned, so a new run clears it.
	const drilled = $derived(
		sweep.selected && sweep.cells[sweep.selected.condition] ? sweep.selected : null
	);
</script>

<div class="sweep" data-testid="sweep">
	{#if sweep.results}
		<!-- The experiment's receipts, always visible above the conclusions. -->
		<div class="tiles" data-testid="sweep-tiles">
			<div class="tile">
				<span class="tv"
					>{sweep.cells.length}<span class="tv-dim">{CELLS_SEPARATOR}{sweep.total}</span></span
				>
				<span class="ts">{sweep.sampled ? 'cells · sampled' : 'cells · full factorial'}</span>
			</div>
			<div class="tile">
				<span class="tv">{sweep.cells.length * (sweep.receipt?.seeds ?? 0)}</span>
				<span class="ts">runs · {sweep.receipt?.seeds ?? 0} seeds each</span>
			</div>
			<div class="tile">
				<span class="tv">{sweep.receipt?.episodes ?? 0} × {sweep.receipt?.genDuration ?? 0}s</span>
				<span class="ts">gens × gen length</span>
			</div>
			<div class="tile">
				<span class="tv">{formatWallClock(sweep.receipt?.wallSeconds ?? 0)}</span>
				<span class="ts">wall clock</span>
			</div>
			<div class="tile">
				{#if strongest}
					<span class="tv" class:helps={strongest.delta > 0} class:costs={strongest.delta < 0}>
						{formatSignedSeconds(strongest.delta)}
					</span>
					<span class="ts">strongest effect · {strongest.label.toLowerCase()}</span>
				{:else}
					<span class="tv">—</span>
					<span class="ts">strongest effect · none cleared zero</span>
				{/if}
			</div>
		</div>

		<section class="card conclusion">
			<header class="card-head">
				<span class="eyebrow">Main effect on survival</span>
				<span class="meta">ranked · 95% interval</span>
			</header>
			<EffectBars effects={effectRows} />
			<p class="read">
				Ranked by size, so the answer reads top-down. A bar clears zero when a factor reliably moves
				survival — <b>teal</b> if it helps, <b>coral</b> if it costs. A muted bar is a knob that does
				nothing in this environment, and the sweep won't round it into a finding.
			</p>
		</section>

		<!-- The interactive evidence: full width, so every cell is a real click target. -->
		<section class="card evidence">
			<header class="card-head">
				<span class="eyebrow">Runs · condition × seed</span>
				{#if sweep.sampled}
					<span class="meta sampled" data-testid="sweep-sampled">
						sampled {sweep.cells.length} of {sweep.total} · click a cell to drill
					</span>
				{:else}
					<span class="meta"
						>{sweep.cells.length} × {sweep.receipt?.seeds ?? 0} · click a cell to drill</span
					>
				{/if}
			</header>
			<RunHeatmap cells={sweep.cells} results={sweep.results} />
		</section>

		{#if drilled}
			<RunCellCard
				cell={sweep.cells[drilled.condition]}
				conditionIndex={drilled.condition}
				seed={drilled.seed}
				evaluation={sweep.results[drilled.condition] ?? null}
				allResults={sweep.results}
				onclose={() => sweep.clearSelection()}
			/>
		{/if}
	{:else}
		<section class="card empty">
			<p class="hint">
				Design the sweep in the panel: pin what should hold, sweep what should vary, set the budget,
				and Run. Every combination is measured across your chosen seeds, and each factor's effect on
				seconds survived is reported with an error bar.
			</p>
		</section>
	{/if}
</div>

<style>
	/* A CONTAINER, so the tiles reflow on the Sweep's OWN width — it sits in a workspace whose width
	   the rail, the design panel and the sidebar change independently of the viewport. */
	.sweep {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		container-type: inline-size;
	}

	/* ---- the honesty tiles: the experiment's receipts in one row ---- */
	.tiles {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: var(--sp-3);
	}

	@container (max-width: 720px) {
		.tiles {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.tile {
		display: flex;
		flex-direction: column;
		gap: 2px;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--panel);
		padding: var(--sp-3) var(--sp-4);
		min-width: 0;
	}

	.tv {
		font-size: var(--fs-stat);
		font-weight: var(--fw-bold);
		color: var(--ink);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.tv-dim {
		color: var(--ink3);
		font-weight: var(--fw-medium);
	}

	.tv.helps {
		color: var(--data-teal);
	}

	.tv.costs {
		color: var(--data-coral);
	}

	.ts {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		min-width: 0;
		padding: var(--sp-5);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
	}

	.card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--sp-3);
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.meta {
		font-size: var(--fs-sm);
		color: var(--ink3);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.meta.sampled {
		color: var(--danger-ink);
	}

	.read {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.empty .hint,
	.hint {
		margin: 0;
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink3);
		max-width: 60ch;
	}
</style>
