<!--
  The Sweep's control toolbar: which factors are in the grid on the left, the run controls grouped on
  the right (how many seeds each condition runs, the grid size, and Run). One bordered bar, so the
  controls read as a single instrument panel rather than loose parts, and the Run button sits WITH the
  seeds and the size readout it acts on — not floating off on its own. Everything wraps down cleanly on
  a narrow stage; the chrome is monochrome, an on-factor reads through a full-ink hairline, not a colour.
-->
<script lang="ts">
	import Button from '../../common/Button.svelte';
	import Icon from '../../common/Icon.svelte';
	import RunProgress from '../RunProgress.svelte';
	import { sweep } from '$lib/state';

	// The input's own bounds, a hint to the browser; the store owns the real clamp (sweep.setSeeds).
	const SEED_RANGE = { min: 2, max: 12 };
</script>

<div class="toolbar">
	<div class="factors">
		<span class="eyebrow">Factors</span>
		<div class="chips" role="group" aria-label="factors in the sweep">
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
			{sweep.plannedCells} conditions × {sweep.seeds} seeds{#if sweep.willSample}
				<span class="cap">· capped to 32</span>{/if}
		</span>

		{#if sweep.running}
			<RunProgress progress={sweep.progress} oncancel={() => sweep.cancel()} />
		{:else}
			<Button variant="primary" disabled={sweep.plannedCells === 0} onclick={() => sweep.run()}>
				<Icon name="forward" size={14} />
				<span>Run sweep</span>
			</Button>
		{/if}
	</div>
</div>

<style>
	.toolbar {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--sp-5) var(--sp-6);
		flex-wrap: wrap;
		padding: var(--sp-5);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
	}

	.factors {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		flex: 1 1 380px;
		min-width: 0;
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2);
	}

	.chip {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 7px 12px;
		border: 1px solid var(--line);
		border-radius: var(--radius-input);
		background: var(--panel2);
		color: var(--ink3);
		cursor: pointer;
		text-align: left;
		transition:
			border-color var(--dur-fast) var(--ease),
			background var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease);
	}

	.chip:hover {
		border-color: var(--ink3);
		color: var(--ink2);
	}

	/* An on-state is a full-ink hairline, the emphasis-by-lightness the platform uses instead of colour. */
	.chip.on {
		border-color: var(--ink);
		box-shadow: inset 0 0 0 1px var(--ink);
		background: var(--panel);
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

	/* The run group stays together, bottom-aligned with the chips, and holds its own on a wide stage. */
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
		width: 56px;
		padding: 7px 10px;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--panel2);
		color: var(--ink);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.seeds input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.summary {
		font-size: var(--fs-sm);
		color: var(--ink2);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.summary .cap {
		color: var(--danger-ink);
	}

	/* On a narrow Sweep the run group drops below the factors and spans the bar, so the Run button never
	   crowds into a corner. Keyed off the Sweep's own width (its `.sweep` container), not the viewport. */
	@container (max-width: 560px) {
		.run {
			flex: 1 1 100%;
			justify-content: space-between;
		}
	}
</style>
