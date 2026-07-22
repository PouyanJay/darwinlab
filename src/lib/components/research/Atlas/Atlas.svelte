<!--
  The Atlas instrument — two knobs in, a survival landscape out.

  A control TOOLBAR runs the plane — the two axes on the left, the run controls (grid size, seeds, the
  cell-count readout, and Run) grouped on the right, one bordered instrument panel like the Sweep's.
  Running paints the plane. Once a field is in, the map fills the workspace and the legend reads it; the
  drilled point you open lives in the console's right sidebar (the DrillCard) — the door back into
  Studio. Until then it says plainly what to do. Everything reads off the landscape store; nothing
  measures here.
-->
<script lang="ts">
	import AxisPicker from './AxisPicker.svelte';
	import LandscapeMap from './LandscapeMap.svelte';
	import Button from '../../common/Button.svelte';
	import Icon from '../../common/Icon.svelte';
	import RunProgress from '../RunProgress.svelte';
	import { landscape } from '$lib/state';
	import { LANDSCAPE_DEFAULTS } from '$lib/lab/landscape';
</script>

<div class="atlas" data-testid="atlas">
	<div class="toolbar">
		<div class="axes-group">
			<span class="eyebrow">Axes</span>
			<AxisPicker />
		</div>

		<div class="run">
			<label class="num">
				<span>grid</span>
				<input
					type="number"
					inputmode="numeric"
					min={LANDSCAPE_DEFAULTS.minRes}
					max={LANDSCAPE_DEFAULTS.maxRes}
					value={landscape.resolution}
					disabled={landscape.running}
					onchange={(event) => landscape.setResolution(Number(event.currentTarget.value))}
				/>
			</label>
			<label class="num">
				<span>seeds</span>
				<input
					type="number"
					inputmode="numeric"
					min={LANDSCAPE_DEFAULTS.minSeeds}
					max={LANDSCAPE_DEFAULTS.maxSeeds}
					value={landscape.seeds}
					disabled={landscape.running}
					onchange={(event) => landscape.setSeeds(Number(event.currentTarget.value))}
				/>
			</label>

			<span class="summary" data-testid="atlas-summary">
				= {landscape.plannedCells} cells × {landscape.seeds} seeds
			</span>

			{#if landscape.running}
				<RunProgress progress={landscape.progress} oncancel={() => landscape.cancel()} />
			{:else}
				<Button variant="primary" onclick={() => landscape.run()}>
					<Icon name="compass" size={14} />
					<span>Run landscape</span>
				</Button>
			{/if}
		</div>
	</div>

	{#if landscape.field}
		<div class="map">
			<LandscapeMap />
		</div>
	{:else}
		<section class="card empty">
			<p class="hint">
				Pick two parameters and run the landscape. Every cell of the grid is a world measured across
				your chosen seeds, coloured by how long its fish survive — so a threshold like the ~0.88×
				predator-speed cliff shows up as a line the colour falls off. Hover a cell for its numbers,
				click to drill in — the drilled point opens in the sidebar, and you can watch that exact
				world back in Studio.
			</p>
		</section>
	{/if}
</div>

<style>
	/* A CONTAINER, so the toolbar reflows on the Atlas's OWN width — it sits in a workspace whose width
	   the rail and sidebar change independently of the viewport, matching the Sweep. */
	.atlas {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
		container-type: inline-size;
	}

	/* One bordered bar — the axes on the left, the run group (grid, seeds, size readout, Run) on the
	   right — so the controls read as a single instrument panel, the same shape as the Sweep's FactorBar
	   rather than loose parts on the page. */
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

	.axes-group {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		min-width: 0;
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	/* The run group stays together, bottom-aligned with the axes, and holds its own on a wide stage. */
	.run {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		flex-wrap: wrap;
	}

	.num {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		font-size: var(--fs-sm);
		color: var(--ink3);
	}

	.num input {
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

	.num input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.num input:disabled {
		opacity: 0.6;
	}

	.summary {
		font-size: var(--fs-sm);
		color: var(--ink2);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* On a narrow Atlas the run group drops below the axes and spans the bar, so Run never crowds into a
	   corner. Keyed off the Atlas's own width (its `.atlas` container), not the viewport — mirrors the
	   Sweep. */
	@container (max-width: 560px) {
		.run {
			flex: 1 1 100%;
			justify-content: space-between;
		}
	}

	/* The map fills the workspace now that the drilled point lives in the console's right sidebar. */
	.map {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		min-width: 0;
	}

	/* The empty-state prompt sits in a bordered card, the same evidence-card shell the Sweep uses. */
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

	.hint {
		margin: 0;
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink3);
		max-width: 60ch;
	}
</style>
