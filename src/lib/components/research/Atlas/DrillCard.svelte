<!--
  The drilled cell, opened in the console's right sidebar. The card answers, in order: WHERE on the
  plane (the cell's axis coordinates loud, the pinned background quiet — all read from the cell's
  own frozen config), WHAT was measured (the cell mean), WHAT LIES NEXT DOOR (one grid step along
  each axis — the map's geometry made local, with a plain-words line saying whether you stand on
  the plateau or at the edge) — and the doors: Watch this world (the Atlas's signature, the
  Research→Studio round-trip) and the notebook.

  NO decorative world preview, on purpose (the owner's standing call for drill cards): every line
  here is a measurement — watching is what the door is for.
-->
<script lang="ts">
	import Button from '../../common/Button.svelte';
	import Icon from '../../common/Icon.svelte';
	import ReportButton from '../ReportButton.svelte';
	import { landscape, findings, EDGE_DROP_SECONDS } from '$lib/state';
	import { BOOL_KNOBS } from '$lib/lab/sweep';
	import { addLandscapeFinding } from './landscapeFinding';
	import { formatSignedSeconds } from '$lib/format';

	const cell = $derived(landscape.selected);
	const value = $derived(landscape.selectedValue);
	// The axes the FIELD was measured on — frozen with the data, so changing the picker before the
	// next run cannot relabel this cell with an axis it was never measured against.
	const field = $derived(landscape.field);

	/** The pinned background, read from the CELL'S OWN config — the panel may have moved on since
	 *  the run, and a chip that read live pins would relabel a measured world. */
	const pinChips = $derived.by(() => {
		if (!cell) return [];
		const senses = BOOL_KNOBS.filter((k) => k.group === 'senses' && !k.needsNineInputs);
		const senseStates = senses.map((k) => k.read(cell.cfg));
		const chips: string[] = senseStates.every(Boolean)
			? ['all senses on']
			: senses.map((k, i) => `${k.label.toLowerCase()} ${senseStates[i] ? 'on' : 'off'}`);
		for (const knob of BOOL_KNOBS.filter((k) => k.group !== 'senses')) {
			chips.push(`${knob.label.toLowerCase()} ${knob.read(cell.cfg) ? 'on' : 'off'}`);
		}
		chips.push(`${cell.cfg.prey} prey`, `${cell.cfg.bw}×${cell.cfg.bh}`);
		chips.push(`${cell.cfg.brainInputs ?? 8}-input brain`);
		return chips;
	});

	const right = $derived(landscape.neighborDelta(1, 0));
	const up = $derived(landscape.neighborDelta(0, 1));
	const atEdge = $derived(right !== null && right < -EDGE_DROP_SECONDS);

	const inReport = $derived(findings.has('atlas'));
</script>

{#if cell && field}
	<!-- A plain div, not an <aside>: it renders inside the console's `complementary` sidebar, so a
	     second complementary landmark here would nest one inside another. -->
	<div class="drill" data-testid="atlas-drill">
		<div class="head">
			<span class="eyebrow">The drill — this cell</span>
			<button
				class="close"
				aria-label="close drilled cell"
				onclick={() => landscape.clearSelection()}
			>
				<Icon name="close" size={14} />
			</button>
		</div>

		<span class="where tabular">Cell {cell.ix + 1},{cell.iy + 1} of {field.cols}×{field.rows}</span>
		<div class="chips">
			<span class="chip hot">{field.axisX.label.toLowerCase()} {field.axisX.format(cell.x)}</span>
			<span class="chip hot">{field.axisY.label.toLowerCase()} {field.axisY.format(cell.y)}</span>
		</div>
		<div class="chips">
			{#each pinChips as chip (chip)}
				<span class="chip">{chip}</span>
			{/each}
		</div>
		<p class="frozen">
			loud chips = this cell's place on the axes; quiet = the pinned background, frozen at
			measurement
		</p>

		<hr class="sep" />

		<div class="row">
			<span>cell mean · {landscape.receipt?.seeds ?? landscape.seeds} seeds</span>
			<b class="tabular">{Number.isFinite(value) ? `${value.toFixed(1)}s` : '—'}</b>
		</div>
		<div class="row">
			<span>one step right · {field.axisX.label.toLowerCase()} ↑</span>
			<b class="tabular" class:neg={right !== null && right < -EDGE_DROP_SECONDS}>
				{right === null ? 'map edge' : formatSignedSeconds(right)}
			</b>
		</div>
		<div class="row">
			<span>one step up · {field.axisY.label.toLowerCase()} ↑</span>
			<b class="tabular" class:neg={up !== null && up < -EDGE_DROP_SECONDS}>
				{up === null ? 'map edge' : formatSignedSeconds(up)}
			</b>
		</div>
		<p class="frozen" data-testid="drill-where">
			{atEdge
				? 'standing at the edge — the next step right falls off the cliff.'
				: 'on the plateau — the neighbours hold roughly the same survival.'}
		</p>

		<hr class="sep" />

		<div class="doors">
			<Button variant="primary" class="wide" onclick={() => landscape.watch(cell)}>
				<span>Watch this world</span>
				<Icon name="forward" size={13} />
			</Button>
			<ReportButton {inReport} onadd={addLandscapeFinding} />
		</div>
		<p class="frozen">
			Watch drops this exact cell onto the Studio bench as a live tank — the Atlas's signature door.
		</p>
	</div>
{/if}

<style>
	.drill {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		padding: var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel2);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.eyebrow {
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.close {
		display: inline-flex;
		padding: 2px;
		border: none;
		background: none;
		color: var(--ink3);
		cursor: pointer;
		border-radius: var(--radius-chip);
	}

	.close:hover {
		color: var(--ink);
	}

	.close:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	.where {
		font-size: var(--fs-md);
		font-weight: var(--fw-bold);
		color: var(--ink);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1);
	}

	.chip {
		font-size: var(--fs-eyebrow);
		border: 1px solid var(--line);
		border-radius: var(--radius-chip);
		padding: 1px 6px;
		color: var(--ink3);
		background: var(--panel);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.chip.hot {
		border-color: var(--ink);
		box-shadow: inset 0 0 0 1px var(--ink);
		color: var(--ink);
	}

	.frozen {
		margin: 0;
		font-size: var(--fs-eyebrow);
		color: var(--ink3);
		line-height: 1.5;
	}

	.sep {
		border: 0;
		border-top: 1px solid var(--line);
		margin: var(--sp-1) 0;
	}

	.row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--sp-3);
		font-size: var(--fs-sm);
		color: var(--ink2);
	}

	.row b {
		color: var(--ink);
		font-size: var(--fs-md);
	}

	.row b.neg {
		color: var(--danger-ink);
	}

	.doors {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding-top: var(--sp-2);
	}

	.drill :global(.btn.wide) {
		width: 100%;
	}
</style>
