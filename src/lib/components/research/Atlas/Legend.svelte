<!--
  The colour scale, read left to right: coral where fish die fast, teal where they last, with the
  measured range at the ends. When the field has a cliff, the note names where along X survival falls
  off hardest — the same line the map draws, in words.
-->
<script lang="ts">
	import { landscape } from '$lib/state';

	const field = $derived(landscape.field);
	const falloff = $derived(landscape.falloff);
</script>

{#if field}
	<div class="legend">
		<div class="scale-row">
			<span class="end tabular">{field.min.toFixed(1)}s</span>
			<span class="bar" aria-hidden="true"></span>
			<span class="end tabular">{field.max.toFixed(1)}s</span>
		</div>
		<span class="caption">Seconds survived · coral = shorter, teal = longer</span>
		{#if falloff}
			<span class="cliff" data-testid="atlas-cliff">
				Steepest fall-off near {landscape.axisX.label.toLowerCase()}
				{landscape.axisX.format(falloff.x)} · −{falloff.drop.toFixed(1)}s
			</span>
		{/if}
	</div>
{/if}

<style>
	.legend {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}

	.scale-row {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}

	.bar {
		flex: 1;
		max-width: 200px;
		height: 8px;
		border-radius: 4px;
		/* Data colours, not chrome — the same coral→teal ramp the heatmap paints. */
		background: linear-gradient(90deg, rgb(232, 96, 76), rgb(14, 148, 136));
	}

	.end {
		font-size: var(--fs-sm);
		color: var(--ink2);
		font-variant-numeric: tabular-nums;
	}

	.caption {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	.cliff {
		font-size: var(--fs-sm);
		color: var(--ink2);
		font-variant-numeric: tabular-nums;
	}
</style>
