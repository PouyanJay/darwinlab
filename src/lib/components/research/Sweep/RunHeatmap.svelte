<!--
  The raw runs behind the effects: one row per condition, one square per seed, lighter the longer that
  seed's population survived. It is the evidence the effect chart is a summary OF — you can see the
  spread the intervals came from, and a condition that did badly across every seed reads as a dark band.
-->
<script lang="ts">
	import type { SweepCell } from '$lib/lab/sweep';
	import type { Evaluation } from '$lib/lab/evaluator';

	interface Props {
		cells: SweepCell[];
		results: (Evaluation | null)[];
	}

	let { cells, results }: Props = $props();

	const seeds = $derived(results.find(Boolean)?.returns.length ?? 0);
	const seedIndices = $derived([...Array(seeds).keys()]);
	const max = $derived(
		Math.max(0.001, ...results.filter(Boolean).flatMap((r) => (r as Evaluation).returns))
	);

	/** Longer survival → more ink; an unmeasured cell (cancelled/failed) is a faint blank. */
	function shade(value: number | undefined): string {
		if (value == null) return 'var(--line2)';
		const t = Math.max(0, Math.min(1, value / max));
		return `color-mix(in oklab, var(--ink) ${Math.round(8 + t * 82)}%, var(--panel2))`;
	}

	const describe = (cell: SweepCell) =>
		Object.entries(cell.levels)
			.map(([key, level]) => `${key} ${level}`)
			.join(' · ');
</script>

{#if seeds === 0}
	<p class="empty">No conditions completed.</p>
{:else}
	<div
		class="heat"
		style:--seeds={seeds}
		role="img"
		aria-label="Survival across {cells.length} conditions and {seeds} seeds; lighter squares survived longer"
	>
		{#each cells as cell, i (cell.index)}
			{#each seedIndices as s (s)}
				<div
					class="cell"
					style:background={shade(results[i]?.returns[s])}
					title="{describe(cell)} · seed {s + 1}: {results[i]?.returns[s]?.toFixed(1) ?? '—'}s"
				></div>
			{/each}
		{/each}
	</div>
{/if}

<style>
	.heat {
		display: grid;
		grid-template-columns: repeat(var(--seeds), 1fr);
		gap: 2px;
		padding: 5px;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--line2);
	}

	.cell {
		height: 10px;
		border-radius: 1.5px;
	}

	.empty {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ink3);
	}
</style>
