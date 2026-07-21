<!--
  The raw runs behind the effects: one COLUMN per condition, one square per seed, coloured by how long
  that seed's population survived — coral where they died fast, teal where they lasted. It is the
  evidence the effect chart is a summary OF: a condition that did badly across every seed reads as a
  coral column, and you can see the spread the intervals came from.

  The colour is a RELATIVE scale (the run's own min→max), not absolute-from-zero — survival here is a
  flat band a few seconds wide, so mapping it from zero would wash every cell to the same shade. The
  scale spreads that real range so the differences that exist are the differences you see.
-->
<script lang="ts">
	import type { SweepCell } from '$lib/lab/sweep';
	import type { Evaluation } from '$lib/lab/evaluator';
	import { heatColor } from '$lib/render';

	interface Props {
		cells: SweepCell[];
		results: (Evaluation | null)[];
	}

	let { cells, results }: Props = $props();

	const seeds = $derived(results.find(Boolean)?.returns.length ?? 0);
	const seedIndices = $derived([...Array(seeds).keys()]);

	// The measured range this run actually spans — the ends of the colour scale.
	const values = $derived(results.filter(Boolean).flatMap((r) => (r as Evaluation).returns));
	const lo = $derived(values.length ? Math.min(...values) : 0);
	const hi = $derived(values.length ? Math.max(...values) : 1);

	/** Coral (shortest) → teal (longest) across the run's own range; an unmeasured cell is a faint blank. */
	function shade(value: number | undefined): string {
		if (value == null) return 'var(--chip)';
		const span = hi - lo || 1;
		return heatColor((value - lo) / span);
	}

	const describe = (cell: SweepCell) =>
		Object.entries(cell.levels)
			.map(([key, level]) => `${key} ${level}`)
			.join(' · ');
</script>

{#if seeds === 0}
	<p class="empty">No conditions completed.</p>
{:else}
	<div class="wrap">
		<div
			class="heat"
			style:--conds={cells.length}
			role="img"
			aria-label="Survival across {cells.length} conditions and {seeds} seeds; teal squares survived longer, coral shorter"
		>
			{#each seedIndices as s (s)}
				{#each cells as cell, i (cell.index)}
					<div
						class="cell"
						style:background={shade(results[i]?.returns[s])}
						title="{describe(cell)} · seed {s + 1}: {results[i]?.returns[s]?.toFixed(1) ?? '—'}s"
					></div>
				{/each}
			{/each}
		</div>
		<div class="scale" aria-hidden="true">
			<span>{lo.toFixed(1)}s</span>
			<span class="ramp"></span>
			<span>{hi.toFixed(1)}s</span>
		</div>
	</div>
{/if}

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		align-items: flex-start;
	}

	.heat {
		display: grid;
		grid-template-columns: repeat(var(--conds), 1fr);
		gap: 2px;
		padding: 5px;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--panel2);
		/* Cap the width so a small run's cells stay square-ish instead of stretching into bands, and
		   let it shrink on narrow. */
		width: 100%;
		max-width: calc(var(--conds) * 24px + 12px);
	}

	.cell {
		aspect-ratio: 1;
		min-height: 9px;
		border-radius: 2px;
	}

	.scale {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
		font-variant-numeric: tabular-nums;
	}

	.ramp {
		width: 96px;
		height: 6px;
		border-radius: 3px;
		background: linear-gradient(90deg, var(--data-coral), var(--data-teal));
	}

	.empty {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ink3);
	}
</style>
