<!--
  The colour scale, read left to right: coral where fish die fast, teal where they last, with the
  measured range at the ends. When the field has a cliff, the note names where along X survival falls
  off hardest — the same line the map draws, in words.
-->
<script lang="ts">
	import { landscape } from '$lib/state';
	import { HEAT_LOW, HEAT_HIGH } from '$lib/render';

	const field = $derived(landscape.field);
	const falloff = $derived(landscape.falloff);
</script>

{#if field}
	<div class="legend">
		<div class="scale-row">
			<span class="end tabular">{field.min.toFixed(1)}s</span>
			<!-- The bar reuses the painter's own ramp ends, so the legend can never drift from the map. -->
			<span class="bar" aria-hidden="true" style:--lo={HEAT_LOW} style:--hi={HEAT_HIGH}></span>
			<span class="end tabular">{field.max.toFixed(1)}s</span>
		</div>
		<span class="caption">Seconds survived · coral = shorter, teal = longer</span>
		{#if falloff}
			<span class="cliff" data-testid="atlas-cliff">
				Steepest fall-off near {field.axisX.label.toLowerCase()}
				{field.axisX.format(falloff.x)} · −{falloff.drop.toFixed(1)}s
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
		/* Data colours, not chrome — the same coral→teal ramp the heatmap paints (from --lo/--hi). */
		background: linear-gradient(90deg, var(--lo), var(--hi));
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
