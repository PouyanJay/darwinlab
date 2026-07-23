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
	import InteractionPlot from '../viz/InteractionPlot.svelte';
	import CurvePair from '../viz/CurvePair.svelte';
	import RunHeatmap from './RunHeatmap.svelte';
	import { sweep } from '$lib/state';
	import {
		sweepCsv,
		toEffectRows,
		toInteractionRows,
		interactionPlotData,
		isUnderTrained,
		levelCurves,
		plainLabel
	} from '$lib/lab/sweep';
	import { rankEffectRows, strongestEffect, isFlatEffect } from '$lib/lab/evidence';
	import { formatSignedSeconds, formatWallClock } from '$lib/format';

	// RANKED by effect size, so the answer reads top-down (the mock's rule) — the shared sorter,
	// so the chart and any other consumer rank identically.
	const effectRows = $derived(rankEffectRows(toEffectRows(sweep.effects)));

	/** Download the run as CSV — built by the lab's one builder, named for its design. */
	function exportCsv(): void {
		// defensive: #commitRun always sets these together, but this fn shouldn't assume its caller
		if (!sweep.results || !sweep.receipt) return;
		const csv = sweepCsv(sweep.lastFactors, sweep.cells, sweep.results, sweep.receipt);
		const blob = new Blob([csv], { type: 'text/csv' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `darwinlab-sweep-${sweep.cells.length}x${sweep.receipt.seeds}.csv`;
		link.click();
		URL.revokeObjectURL(link.href);
	}

	/** Rendered through an expression so the build can never collapse its spaces — as a literal text
	 *  node the production build shipped '2/ 2' once (and a string-literal mustache trips lint). */
	const CELLS_SEPARATOR = ' / ';

	/** The headline tile: the strongest factor whose interval CLEARS ZERO — the same isFlatEffect
	 *  test as the muted bars and the sidebar's lead, so the tile can never paint a confident colour
	 *  over a bar the card beneath it mutes. Null = a flat environment, itself a real result. */
	const strongest = $derived(strongestEffect(effectRows));

	// The interactions as EffectRow shapes through the ONE converter, so the same ranking and
	// flatness rules the main effects obey (rankEffectRows / isFlatEffect) apply to the pairs.
	const interactionRows = $derived(rankEffectRows(toInteractionRows(sweep.interactions)));

	/** The pair the plot draws: the strongest REAL interaction, else the largest overall — picked
	 *  by the pair's own KEYS, not its rendered label. */
	const topPair = $derived.by(() => {
		const pairs = sweep.interactions;
		if (pairs.length === 0) return null;
		const rowOf = (pair: (typeof pairs)[number]) => toInteractionRows([pair])[0];
		const magnitude = (pair: (typeof pairs)[number]) =>
			Number.isNaN(pair.effect.delta) ? -1 : Math.abs(pair.effect.delta);
		const real = pairs.filter((pair) => !isFlatEffect(rowOf(pair)));
		const pool = real.length ? real : pairs;
		return pool.reduce((best, pair) => (magnitude(pair) > magnitude(best) ? pair : best));
	});

	const plot = $derived.by(() => {
		if (!topPair || !sweep.results) return null;
		const a = sweep.lastFactors.find((f) => f.key === topPair.keyA);
		const b = sweep.lastFactors.find((f) => f.key === topPair.keyB);
		if (!a || !b) return null;
		return {
			...interactionPlotData(a, b, sweep.cells, sweep.results),
			bLabel: plainLabel(b.label)
		};
	});

	/** The convergence card's factor: the strongest effect's, else the first swept factor. */
	const convergence = $derived.by(() => {
		if (!sweep.results || sweep.lastFactors.length === 0) return null;
		const lead = strongest ?? effectRows[0];
		const factor = sweep.lastFactors.find((f) => f.label === lead?.label) ?? sweep.lastFactors[0];
		const arms = levelCurves(factor, sweep.cells, sweep.results);
		if (arms.from.length === 0 && arms.to.length === 0) return null;
		return {
			factor,
			arms,
			// LEVEL-only labels: the card's header names the factor, and the full name clipped at
			// the chart's right edge ("Predator speed × 0.6×" also doubled the unit mark).
			fromLabel: factor.levels[0].label,
			toLabel: factor.levels[factor.levels.length - 1].label,
			underTrained: isUnderTrained(arms.from) || isUnderTrained(arms.to)
		};
	});
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

		<!-- The two CONCLUSIONS side by side: what moves survival, and which knobs depend on each
		     other. They stack when the workspace can no longer hold two comfortable columns. -->
		<div class="conclusions">
			<section class="card conclusion">
				<header class="card-head">
					<span class="eyebrow">Main effect on survival</span>
					<span class="meta">ranked · 95% interval</span>
				</header>
				<EffectBars effects={effectRows} />
				<p class="read">
					Ranked by size, so the answer reads top-down. A bar clears zero when a factor reliably
					moves survival — <b>teal</b> if it helps, <b>coral</b> if it costs. A muted bar is a knob that
					does nothing in this environment, and the sweep won't round it into a finding.
				</p>
			</section>

			<section class="card" data-testid="sweep-interactions">
				<header class="card-head">
					<span class="eyebrow">Interactions</span>
					<span class="meta">all pairs tested</span>
				</header>
				{#if interactionRows.length === 0}
					<p class="read">Sweep two or more factors and every pair is tested for interaction.</p>
				{:else}
					<div class="pairs">
						{#each interactionRows as row (row.label)}
							<div class="pair" class:flat={isFlatEffect(row)}>
								<span class="pdot" aria-hidden="true"></span>
								<span class="pname">{row.label}</span>
								<span class="pval tabular">
									{Number.isNaN(row.delta)
										? '—'
										: `${formatSignedSeconds(row.delta)}${isFlatEffect(row) ? ' · flat' : ' · matters'}`}
								</span>
							</div>
						{/each}
					</div>
					{#if plot}
						<InteractionPlot {...plot} />
						<p class="read">
							Parallel lines = the factors are independent; <b>diverging lines</b> mean one factor's value
							depends on the other — the flagged pairs are where the interval clears zero.
						</p>
					{/if}
				{/if}
			</section>
		</div>

		<!-- The interactive evidence: full width, so every cell is a real click target. -->
		<section class="card evidence">
			<header class="card-head">
				<span class="eyebrow">Runs · condition × seed</span>
				{#if sweep.sampled}
					<span class="meta sampled" data-testid="sweep-sampled">
						sampled {sweep.cells.length} of {sweep.total} · a click opens the cell in the sidebar
					</span>
				{:else}
					<span class="meta"
						>{sweep.cells.length} × {sweep.receipt?.seeds ?? 0} · click a cell to drill</span
					>
				{/if}
			</header>
			<RunHeatmap cells={sweep.cells} results={sweep.results} />
		</section>

		{#if convergence}
			<section class="card" data-testid="sweep-convergence">
				<header class="card-head">
					<span class="eyebrow">Did training suffice?</span>
					<span class="meta"
						>learning curves · {plainLabel(convergence.factor.label).toLowerCase()} arms</span
					>
				</header>
				<CurvePair
					from={convergence.arms.from}
					to={convergence.arms.to}
					fromLabel={convergence.fromLabel}
					toLabel={convergence.toLabel}
				/>
				{#if convergence.underTrained}
					<p class="read warn" data-testid="sweep-under-trained">
						⚠ <b>Under-trained:</b> an arm is still climbing at the last generation — the effects above
						may grow with a longer budget. Raise generations per run before trusting a null.
					</p>
				{:else}
					<p class="read">
						Both arms plateau before the budget ends — the training was long enough for the effects
						above to be trusted at this budget.
					</p>
				{/if}
			</section>
		{/if}
		<div class="exports">
			<button class="xbtn" onclick={exportCsv}>Export CSV</button>
			<span class="xnote"
				>the file carries the full design — cells, levels, seeds, budget, champion</span
			>
		</div>
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

	/* Two conclusions side by side on a wide stage; stacked when the container narrows. */
	.conclusions {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--sp-5);
		align-items: stretch;
	}

	@container (max-width: 720px) {
		.conclusions {
			grid-template-columns: 1fr;
		}
	}

	.pairs {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}

	.pair {
		display: flex;
		align-items: baseline;
		gap: var(--sp-3);
		font-size: var(--fs-sm);
		color: var(--ink2);
	}

	.pdot {
		flex: none;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--data-teal);
		align-self: center;
	}

	.pair.flat .pdot {
		background: none;
		box-shadow: inset 0 0 0 1.5px var(--ink3);
	}

	.pair.flat {
		color: var(--ink3);
	}

	.pname {
		flex: 1;
		min-width: 0;
	}

	.pval {
		white-space: nowrap;
	}

	.read.warn {
		color: var(--gold-ink);
	}

	.read.warn b {
		color: var(--gold-ink);
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

	.exports {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
	}

	.xbtn {
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		background: none;
		color: var(--ink2);
		font: inherit;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		padding: 6px 12px;
		cursor: pointer;
		transition:
			border-color var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease);
	}

	.xbtn:hover {
		border-color: var(--ink3);
		color: var(--ink);
	}

	.xbtn:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	.xnote {
		font-size: var(--fs-xs);
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
