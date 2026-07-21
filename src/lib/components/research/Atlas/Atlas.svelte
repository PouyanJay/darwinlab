<!--
  The Atlas instrument — two knobs in, a survival landscape out.

  The controls choose the two axes and how densely to sample them; running paints the plane. Once a
  field is in, the map leads and the legend reads it, with a drilled point (when you open one) beside
  it — the door back into Studio. Until then it says plainly what to do. Everything reads off the
  landscape store; nothing measures here.
-->
<script lang="ts">
	import AxisPicker from './AxisPicker.svelte';
	import LandscapeMap from './LandscapeMap.svelte';
	import Legend from './Legend.svelte';
	import DrillCard from './DrillCard.svelte';
	import Button from '../../common/Button.svelte';
	import Icon from '../../common/Icon.svelte';
	import RunProgress from '../RunProgress.svelte';
	import { landscape } from '$lib/state';
	import { LANDSCAPE_DEFAULTS } from '$lib/lab/landscape';
</script>

<div class="atlas" data-testid="atlas">
	<div class="controls">
		<AxisPicker />

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

			<span class="summary tabular" data-testid="atlas-summary">
				= {landscape.plannedCells} cells × {landscape.seeds} seeds
			</span>

			{#if landscape.running}
				<RunProgress progress={landscape.progress} oncancel={() => landscape.cancel()} />
			{:else}
				<Button variant="primary" size="sm" onclick={() => landscape.run()}>
					<Icon name="compass" size={13} />
					<span>Run landscape</span>
				</Button>
			{/if}
		</div>
	</div>

	{#if landscape.field}
		<div class="plane">
			<div class="main">
				<LandscapeMap />
				<Legend />
			</div>
			<div class="side">
				<DrillCard />
			</div>
		</div>
	{:else}
		<p class="hint">
			Pick two parameters and run the landscape. Every cell of the grid is a world measured across
			your chosen seeds, coloured by how long its fish survive — so a threshold like the ~0.88×
			predator-speed cliff shows up as a line the colour falls off. Hover a cell for its numbers,
			click to drill in, and watch that exact world back in Studio.
		</p>
	{/if}
</div>

<style>
	.atlas {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}

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
		margin-right: auto;
	}

	.plane {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
		gap: var(--sp-5);
		align-items: start;
	}

	.main {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		min-width: 0;
	}

	.side {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}

	/* On a narrow stage the drill card drops below the map rather than squeezing it. */
	@media (max-width: 720px) {
		.plane {
			grid-template-columns: 1fr;
		}
	}

	.hint {
		margin: 0;
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink3);
		max-width: 60ch;
	}
</style>
