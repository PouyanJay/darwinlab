<!--
  The Sweep instrument — factors in, effect sizes out.

  A control TOOLBAR runs the grid; when the results are in, they land as two cards: the conclusion
  (each factor's main effect on survival, with intervals) leads, and the raw run grid sits beside it as
  the evidence. Until then it says plainly what to do. Everything reads off the sweep store; nothing
  measures here.
-->
<script lang="ts">
	import FactorBar from './FactorBar.svelte';
	import EffectBars from '../viz/EffectBars.svelte';
	import RunHeatmap from './RunHeatmap.svelte';
	import { sweep } from '$lib/state';
	import { toEffectRows } from '$lib/lab/sweep';

	const effectRows = $derived(toEffectRows(sweep.effects));
</script>

<div class="sweep" data-testid="sweep">
	<FactorBar />

	{#if sweep.results}
		<div class="results">
			<section class="card conclusion">
				<header class="card-head">
					<span class="eyebrow">Main effect on survival</span>
					<span class="meta">95% interval</span>
				</header>
				<EffectBars effects={effectRows} />
				<p class="read">
					A bar clears zero when a factor reliably moves survival — <b>teal</b> if it helps,
					<b>coral</b> if it costs. A muted bar is a knob that does nothing in this environment, and the
					sweep won't round it into a finding.
				</p>
			</section>

			<section class="card evidence">
				<header class="card-head">
					<span class="eyebrow">Runs · condition × seed</span>
					{#if sweep.sampled}
						<span class="meta sampled" data-testid="sweep-sampled">
							sampled {sweep.cells.length} of {sweep.total}
						</span>
					{:else}
						<span class="meta">{sweep.cells.length} × {sweep.seeds}</span>
					{/if}
				</header>
				<RunHeatmap cells={sweep.cells} results={sweep.results} />
			</section>
		</div>
	{:else}
		<section class="card empty">
			<p class="hint">
				Pick the factors to vary and run the sweep. Every combination is measured across your chosen
				seeds, and each factor's effect on seconds survived is reported with an error bar.
			</p>
		</section>
	{/if}
</div>

<style>
	/* A CONTAINER, so the cards below reflow on the Sweep's OWN width — it sits in a workspace whose
	   width the rail and sidebar change independently of the viewport, so a viewport query would stack
	   too early or too late. */
	.sweep {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		container-type: inline-size;
	}

	/* Two equal cards on a wide stage — the conclusion (the answer) beside the evidence (the run grid);
	   they stack when the Sweep can no longer hold two comfortable columns. */
	.results {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--sp-5);
		align-items: start;
	}

	@container (max-width: 720px) {
		.results {
			grid-template-columns: 1fr;
		}
	}

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

	.card-head {
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

	.meta {
		font-size: var(--fs-sm);
		color: var(--ink3);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.meta.sampled {
		color: var(--danger-ink);
	}

	.read {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.empty .hint,
	.hint {
		margin: 0;
		font-size: var(--fs-body);
		line-height: var(--leading-body);
		color: var(--ink3);
		max-width: 60ch;
	}
</style>
