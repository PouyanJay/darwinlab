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
	import type { EffectRow } from '$lib/lab/evidence';

	// RANKED by effect size, so the answer reads top-down (the mock's rule). NaN deltas (an arm with
	// no results) sink to the bottom rather than poisoning the sort.
	const effectRows = $derived(
		toEffectRows(sweep.effects).toSorted((a: EffectRow, b: EffectRow) => {
			const A = Number.isNaN(a.delta) ? -1 : Math.abs(a.delta);
			const B = Number.isNaN(b.delta) ? -1 : Math.abs(b.delta);
			return B - A;
		})
	);

	/** The headline tile: the largest real effect, teal/coral by its sign. */
	const strongest = $derived(effectRows.find((row) => !Number.isNaN(row.delta)) ?? null);

	/** Sub-minute walls show real seconds ("7.4s") — a fast pool would otherwise print a broken-
	 *  looking "0:00" for a run that honestly took half a second. */
	const wall = (seconds: number) => {
		if (seconds < 60) return `${seconds.toFixed(1)}s`;
		const m = Math.floor(seconds / 60);
		const rest = Math.round(seconds % 60);
		return `${m}:${String(rest).padStart(2, '0')}`;
	};

	/** A delta that rounds to 0.0 is shown unsigned — "−0.0s" would claim a direction it hasn't. */
	const flat = (delta: number) => Math.abs(delta) < 0.05;

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
				<span class="tv tabular"
					>{sweep.cells.length}<span class="tv-dim"> / {sweep.total}</span></span
				>
				<span class="ts">{sweep.sampled ? 'cells · sampled' : 'cells · full factorial'}</span>
			</div>
			<div class="tile">
				<span class="tv tabular">{sweep.cells.length * (sweep.receipt?.seeds ?? 0)}</span>
				<span class="ts">runs · {sweep.receipt?.seeds ?? 0} seeds each</span>
			</div>
			<div class="tile">
				<span class="tv tabular"
					>{sweep.receipt?.episodes ?? 0} × {sweep.receipt?.genDuration ?? 0}s</span
				>
				<span class="ts">gens × gen length</span>
			</div>
			<div class="tile">
				<span class="tv tabular">{wall(sweep.receipt?.wallSeconds ?? 0)}</span>
				<span class="ts">wall clock</span>
			</div>
			<div class="tile">
				{#if strongest}
					<span
						class="tv tabular"
						class:helps={!flat(strongest.delta) && strongest.delta > 0}
						class:costs={!flat(strongest.delta) && strongest.delta < 0}
					>
						{flat(strongest.delta)
							? '±0.0s'
							: `${strongest.delta > 0 ? '+' : '−'}${Math.abs(strongest.delta).toFixed(1)}s`}
					</span>
					<span class="ts">strongest effect · {strongest.label.toLowerCase()}</span>
				{:else}
					<span class="tv">—</span>
					<span class="ts">strongest effect</span>
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
