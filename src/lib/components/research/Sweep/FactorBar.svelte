<!--
  The sweep's controls: which factors are in the grid, how many seeds each condition runs, and the
  Run button. Each chip is a factor and its levels; toggling it in or out changes the grid, and the
  summary says how big that grid is — with an honest note when it would overflow the cap and be sampled.
-->
<script lang="ts">
	import Button from '../../common/Button.svelte';
	import Icon from '../../common/Icon.svelte';
	import RunProgress from '../RunProgress.svelte';
	import { sweep } from '$lib/state';

	// The input's own bounds, a hint to the browser; the store owns the real clamp (sweep.setSeeds).
	const SEED_RANGE = { min: 2, max: 12 };
</script>

<div class="factorbar">
	<div class="factors" role="group" aria-label="factors in the sweep">
		{#each sweep.factors as factor (factor.key)}
			<button
				class="chip"
				class:on={sweep.isSelected(factor.key)}
				aria-pressed={sweep.isSelected(factor.key)}
				onclick={() => sweep.toggle(factor.key)}
			>
				<span class="fname">{factor.label}</span>
				<span class="flevels">{factor.levels.map((level) => level.label).join(' / ')}</span>
			</button>
		{/each}
	</div>

	<div class="run">
		<label class="seeds">
			<span>seeds</span>
			<input
				type="number"
				inputmode="numeric"
				min={SEED_RANGE.min}
				max={SEED_RANGE.max}
				value={sweep.seeds}
				onchange={(event) => sweep.setSeeds(Number(event.currentTarget.value))}
			/>
		</label>

		<span class="summary" data-testid="sweep-summary">
			= {sweep.plannedCells} conditions × {sweep.seeds} seeds{#if sweep.willSample}
				<span class="cap">· capped to 32</span>{/if}
		</span>

		{#if sweep.running}
			<RunProgress progress={sweep.progress} oncancel={() => sweep.cancel()} />
		{:else}
			<Button
				variant="primary"
				size="sm"
				disabled={sweep.plannedCells === 0}
				onclick={() => sweep.run()}
			>
				<Icon name="forward" size={13} />
				<span>Run sweep</span>
			</Button>
		{/if}
	</div>
</div>

<style>
	.factorbar {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}

	.factors {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2);
	}

	.chip {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 6px 11px;
		border: 1px solid var(--line);
		border-radius: var(--radius-input);
		background: var(--panel);
		color: var(--ink3);
		cursor: pointer;
		text-align: left;
		transition:
			border-color var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease);
	}

	.chip:hover {
		border-color: var(--ink3);
	}

	/* In the sweep, an on-state is a full-ink hairline — the same emphasis-by-lightness the rest of
	   the platform uses instead of colour. */
	.chip.on {
		border-color: var(--ink);
		box-shadow: 0 0 0 1px var(--ink);
		color: var(--ink);
	}

	.chip:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	.fname {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
	}

	.flevels {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
		font-variant-numeric: tabular-nums;
	}

	.run {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		flex-wrap: wrap;
	}

	.seeds {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		font-size: var(--fs-sm);
		color: var(--ink3);
	}

	.seeds input {
		width: 52px;
		padding: 5px 8px;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--panel2);
		color: var(--ink);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.seeds input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.summary {
		font-size: var(--fs-sm);
		color: var(--ink2);
		font-variant-numeric: tabular-nums;
		margin-right: auto;
	}

	.summary .cap {
		color: var(--danger-ink);
	}
</style>
