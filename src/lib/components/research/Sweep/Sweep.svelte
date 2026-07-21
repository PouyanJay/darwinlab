<!--
  The Sweep instrument — factors in, effect sizes out.

  The factor bar runs the grid; when the results are in, the conclusion (each factor's main effect on
  survival, with intervals) leads, and the raw run grid sits beneath it as the evidence. Until then it
  says plainly what to do. Everything reads off the sweep store; nothing measures here.
-->
<script lang="ts">
	import FactorBar from './FactorBar.svelte';
	import EffectBars from '../viz/EffectBars.svelte';
	import RunHeatmap from './RunHeatmap.svelte';
	import { sweep } from '$lib/state';

	// The Sweep's effects carry more than the graph needs (keys, level labels); map to the compact
	// EffectRow the shared EffectBars (and the Report) both draw from.
	const effectRows = $derived(
		sweep.effects.map((e) => ({
			label: e.label,
			delta: e.effect.delta,
			lo: e.effect.ci.lo,
			hi: e.effect.ci.hi
		}))
	);
</script>

<div class="sweep" data-testid="sweep">
	<FactorBar />

	{#if sweep.results}
		<div class="results">
			<section class="block conclusion">
				<div class="head">
					<span class="eyebrow">Main effect on survival · 95% interval</span>
				</div>
				<EffectBars effects={effectRows} />
				<p class="read">
					A bar clears zero when a factor reliably moves survival — <b>teal</b> if it helps,
					<b>coral</b> if it costs. A muted bar is a knob that does nothing in this environment, and the
					sweep won't round it into a finding.
				</p>
			</section>

			<section class="block evidence">
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
		</div>
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

	/* Conclusion beside evidence on a wide stage — the effect chart (the answer) leads and takes the
	   room its bars need; the run grid (the evidence) sits alongside. They stack on a narrow stage. */
	.results {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 340px);
		gap: var(--sp-7);
		align-items: start;
	}

	@media (max-width: 760px) {
		.results {
			grid-template-columns: 1fr;
			gap: var(--sp-6);
		}
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		min-width: 0;
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
