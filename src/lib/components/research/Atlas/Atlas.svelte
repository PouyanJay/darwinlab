<!--
  The Atlas instrument — two knobs in, a survival landscape out.

  Since the landscape-panel redesign the workspace holds only EVIDENCE: the honesty tiles (the
  run's receipts, with the measured fall-off as the headline), the painted landscape with its
  row-traced cliff, the cross-section that reads the edge as a curve, and the exports. Designing
  and firing live in the design panel (the console's second zone); the drilled cell opens in the
  right sidebar. Everything reads off the landscape store; nothing measures here.
-->
<script lang="ts">
	import LandscapeMap from './LandscapeMap.svelte';
	import CliffSection from './CliffSection.svelte';
	import Button from '../../common/Button.svelte';
	import ReportButton from '../ReportButton.svelte';
	import { landscape, findings } from '$lib/state';
	import { landscapeCsv } from '$lib/lab/landscape';
	import { addLandscapeFinding } from './landscapeFinding';
	import { downloadText } from '$lib/download';
	import { formatWallClock } from '$lib/format';

	const field = $derived(landscape.field);
	const receipt = $derived(landscape.receipt);
	const falloff = $derived(landscape.falloff);
	const inReport = $derived(findings.has('atlas'));

	function exportCsv(): void {
		if (!field || !receipt) return;
		downloadText('darwin-lab-atlas.csv', landscapeCsv(field, receipt), 'text/csv');
	}
</script>

<div class="atlas" data-testid="atlas">
	{#if field}
		<!-- The experiment's receipts, always visible above the conclusions. -->
		<div class="tiles" data-testid="atlas-tiles">
			<div class="tile">
				<span class="tv">{field.cols * field.rows}</span>
				<span class="ts">cells · {field.cols} × {field.rows}</span>
			</div>
			<div class="tile">
				<span class="tv">{field.cols * field.rows * (receipt?.seeds ?? 0)}</span>
				<span class="ts">runs · {receipt?.seeds ?? 0} seeds each</span>
			</div>
			<div class="tile">
				<span class="tv">{receipt?.episodes ?? 0} × 10s</span>
				<span class="ts">gens × gen length</span>
			</div>
			<div class="tile">
				<span class="tv">{formatWallClock(receipt?.wallSeconds ?? 0)}</span>
				<span class="ts">wall clock</span>
			</div>
			<div class="tile headline">
				{#if falloff}
					<span class="tv">{field.axisX.format(falloff.x)}</span>
					<span class="ts">steepest fall-off · −{falloff.drop.toFixed(1)}s per step</span>
				{:else}
					<span class="tv">—</span>
					<span class="ts">no sharp fall-off along {field.axisX.label.toLowerCase()}</span>
				{/if}
			</div>
		</div>

		<!-- THE MAP — the instrument itself. -->
		<section class="card">
			<header class="card-head">
				<span class="eyebrow">The landscape</span>
				<span class="meta">mean seconds survived · click a cell to drill</span>
			</header>
			<LandscapeMap />
			<p class="read">
				Every cell is a full evolution experiment on the subject, coloured by mean survival. The
				<b>gold dashes trace the cliff</b> — each row's steepest survival drop, found by the run, not
				drawn by hand. This is the Q4 answer as a picture: the region where the world holds, and the edge
				where it stops holding.
			</p>
		</section>

		<!-- THE CROSS-SECTION — the map's geometry as the Q4 sentence. -->
		<section class="card" data-testid="atlas-section-card">
			<header class="card-head">
				<span class="eyebrow">The cliff, read as a curve</span>
				<span class="meta">the map's low and high {field.axisY.label.toLowerCase()} rows</span>
			</header>
			<CliffSection />
			<p class="read">
				Two rows of the map, read as curves, each with its own measured edge marked. If the edges
				sit apart, <b>{field.axisY.label.toLowerCase()} moves the cliff</b> — that sentence, where the
				edge is and what moves it, is the finding the notebook receives.
			</p>
		</section>

		<div class="exports">
			<Button variant="ghost" size="sm" onclick={exportCsv}>Export CSV</Button>
			<ReportButton {inReport} onadd={addLandscapeFinding} />
			<span class="note"
				>every export carries the design: subject, axes + ranges, resolution, seeds</span
			>
		</div>
	{:else}
		<section class="card empty">
			<p class="hint">
				Design the plane on the left — two axes with real ranges, the resolution, the pinned
				background — and paint it. Every cell of the grid is a world measured across your chosen
				seeds, coloured by how long its fish survive; the cliff where survival falls off is traced
				in gold. Click any cell to drill in, and watch that exact world back in Studio.
			</p>
		</section>
	{/if}
</div>

<style>
	/* A CONTAINER, so the tiles reflow on the Atlas's OWN width — it sits in a workspace whose width
	   the rail, panel and sidebar change independently of the viewport. */
	.atlas {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		container-type: inline-size;
	}

	/* ---- the honesty tiles: the experiment's receipts in one row ---- */
	.tiles {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: var(--sp-3);
	}

	.tile {
		display: flex;
		flex-direction: column;
		gap: 2px;
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--panel);
		padding: var(--sp-3) var(--sp-4);
	}

	.tv {
		font-size: var(--fs-stat);
		font-weight: var(--fw-bold);
		font-variant-numeric: tabular-nums;
		color: var(--ink);
	}

	.tile.headline .tv {
		color: var(--gold-ink);
	}

	.ts {
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
	}

	@container (max-width: 720px) {
		.tiles {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	/* ---- the evidence cards ---- */
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
		justify-content: space-between;
		align-items: baseline;
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

	.read {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	.read b {
		color: var(--ink2);
	}

	.exports {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}

	.note {
		margin-left: auto;
		font-size: var(--fs-xs);
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
