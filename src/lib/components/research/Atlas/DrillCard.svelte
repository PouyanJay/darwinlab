<!--
  A drilled point — one cell of the landscape, opened. It names where on the plane it sits, how long
  its fish survived, and offers the round-trip back to Studio: "Watch this world" drops this exact
  config onto the bench as a fresh world and switches modes, so a spot on the map becomes a world you
  can watch evolve. The Atlas is where you find a place worth looking; this is the door into it.
-->
<script lang="ts">
	import Button from '../../common/Button.svelte';
	import Icon from '../../common/Icon.svelte';
	import { landscape } from '$lib/state';

	const cell = $derived(landscape.selected);
	const value = $derived(landscape.selectedValue);
	// The axes the FIELD was measured on — frozen with the data, so changing the picker before the
	// next run cannot relabel this cell with an axis it was never measured against.
	const field = $derived(landscape.field);
</script>

{#if cell && field}
	<aside class="drill" data-testid="atlas-drill" aria-label="drilled point">
		<div class="head">
			<span class="eyebrow">Drilled point</span>
			<button
				class="close"
				aria-label="close drilled point"
				onclick={() => landscape.clearSelection()}
			>
				<Icon name="close" size={14} />
			</button>
		</div>

		<dl class="stats">
			<div>
				<dt>{field.axisX.label}</dt>
				<dd class="tabular">{field.axisX.format(cell.x)}</dd>
			</div>
			<div>
				<dt>{field.axisY.label}</dt>
				<dd class="tabular">{field.axisY.format(cell.y)}</dd>
			</div>
			<div>
				<dt>Survival</dt>
				<dd class="tabular">{Number.isFinite(value) ? `${value.toFixed(1)}s` : '—'}</dd>
			</div>
		</dl>

		<Button variant="primary" size="sm" onclick={() => landscape.watch(cell)}>
			<Icon name="forward" size={13} />
			<span>Watch this world</span>
		</Button>
	</aside>
{/if}

<style>
	.drill {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		padding: var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
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

	.stats {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		margin: 0;
	}

	.stats div {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--sp-3);
	}

	dt {
		font-size: var(--fs-sm);
		color: var(--ink3);
	}

	dd {
		margin: 0;
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
</style>
