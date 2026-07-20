<!--
  The Sweep instrument — factors in, effect sizes out.

  The factor bar runs the grid; when the results are in, the conclusion (each factor's main effect on
  survival, with intervals) leads, and the raw run grid sits beneath it as the evidence. Until then it
  says plainly what to do. Everything reads off the sweep store; nothing measures here.
-->
<script lang="ts">
	import FactorBar from './FactorBar.svelte';
	import EffectChart from './EffectChart.svelte';
	import RunHeatmap from './RunHeatmap.svelte';
	import { sweep } from '$lib/state';
</script>

<div class="sweep" data-testid="sweep">
	<FactorBar />

	{#if sweep.results}
		<section class="block">
			<div class="head">
				<span class="eyebrow">Main effect on survival · 95% interval</span>
			</div>
			<EffectChart effects={sweep.effects} />
			<p class="read">
				A bar clears zero when a factor reliably moves survival; a muted bar is a knob that does
				nothing in this environment — the sweep won't round it into a finding.
			</p>
		</section>

		<section class="block">
			<div class="head">
				<span class="eyebrow">Runs · condition × seed</span>
				{#if sweep.sampled}
					<span class="sampled" data-testid="sweep-sampled">
						sampled {sweep.cells.length} of {sweep.total} conditions
					</span>
				{/if}
			</div>
			<RunHeatmap cells={sweep.cells} results={sweep.results} />
		</section>
	{:else}
		<p class="hint">
			Pick the factors to vary and run the sweep. Every combination is measured across your chosen
			seeds, and each factor's effect on seconds survived is reported with an error bar.
		</p>
	{/if}
</div>

<style>
	.sweep {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}

	.head {
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

	.sampled {
		font-size: var(--fs-sm);
		color: var(--danger-ink);
		font-variant-numeric: tabular-nums;
	}

	.read {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.hint {
		margin: 0;
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink3);
		max-width: 60ch;
	}
</style>
