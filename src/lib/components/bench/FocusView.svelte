<!--
  The focus view — one world blown up to fill the pane, the whole roster shrunk into a scrolling rail
  down the left. The alternative to the pannable lineage canvas: reach for it (the header's expand
  control) when a world has your full attention and its neighbours only need to be a glance away.

  The rail lists EVERY world, not just the others — the focused one stays in place, highlighted, so
  the list never reshuffles as you move between them; the count and the fade edges say there is more
  below; and expanding a world scrolls its card into view. It fills the height and scrolls its
  overflow, so a bench of any size just keeps going rather than being capped at what fits.
-->
<script lang="ts">
	import Workbench from './Workbench.svelte';
	import WorldRailCard from './WorldRailCard.svelte';
	import Icon from '../common/Icon.svelte';
	import { bench } from '$lib/state';

	interface Props {
		/** Add a fresh root world — offered at the foot of the rail, as the canvas offers it in a corner. */
		onaddworld: () => void;
	}

	let { onaddworld }: Props = $props();

	const worlds = $derived(bench.worlds);
	const focusedIndex = $derived(worlds.findIndex((entry) => entry.id === bench.focusedId));
	const focused = $derived(focusedIndex >= 0 ? worlds[focusedIndex] : null);

	let railEl = $state<HTMLElement | null>(null);

	// Keep the focused world's card in view when focus changes — the reason the whole roster stays
	// listed rather than dropping the focused one is that the rail must not jump under the pointer.
	$effect(() => {
		void bench.focusedId;
		railEl?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' });
	});
</script>

{#if focused}
	<div class="focus">
		<aside class="rail-wrap" aria-label="worlds">
			<div class="rail" bind:this={railEl}>
				<div class="rail-head">
					<span>Worlds · {worlds.length}</span>
					<span class="hint" aria-hidden="true">scroll</span>
				</div>

				{#each worlds as entry, i (entry.id)}
					<WorldRailCard
						{entry}
						index={i + 1}
						active={entry.id === bench.focusedId}
						onfocus={() => bench.focus(entry.id)}
					/>
				{/each}

				<button class="add" onclick={onaddworld}>
					<Icon name="plus" size={14} />
					<span>Add environment</span>
				</button>
			</div>
		</aside>

		<!-- The focused world as a workbench. Keyed on its id so switching worlds remounts cleanly — a
		     fresh tank painter and a fresh champion selection, not the previous world's re-labelled. -->
		<div class="detail">
			{#key focused.id}
				<Workbench entry={focused} index={focusedIndex + 1} />
			{/key}
		</div>
	</div>
{/if}

<style>
	.focus {
		display: grid;
		grid-template-columns: 256px minmax(0, 1fr);
		/* The single row is BOUNDED to the pane, not auto-sized to its tallest child. Without this the
		   row grew to the full height of a 12-card rail (~2900px) and the rail then had no overflow to
		   scroll — it just ran off the bottom of the screen. minmax(0,1fr) pins the row to the viewport
		   so the rail scrolls its own overflow instead. */
		grid-template-rows: minmax(0, 1fr);
		gap: var(--sp-6);
		width: 100%;
		height: 100%;
		/* `.focus` is a flex item of <main>; without min-height:0 the flexbox min-height:auto rule lets
		   it grow to its tallest child (the full rail), so height:100% never bit and the rail could not
		   scroll. This is what actually bounds it to the pane. */
		min-height: 0;
		padding: var(--sp-6) var(--sp-7);
		overflow: hidden;
	}

	.rail-wrap {
		position: relative;
		min-height: 0;
	}

	/* Fade the rail's top and bottom so a long list reads as "more here" rather than a hard clip. */
	.rail-wrap::before,
	.rail-wrap::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		height: 20px;
		pointer-events: none;
		z-index: 2;
	}

	.rail-wrap::before {
		top: 26px;
		background: linear-gradient(var(--bgfx), transparent);
	}

	.rail-wrap::after {
		bottom: 0;
		background: linear-gradient(transparent, var(--bgfx));
	}

	.rail {
		height: 100%;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		padding-right: 4px;
		scrollbar-width: thin;
		scrollbar-color: var(--line) transparent;
	}

	.rail-head {
		position: sticky;
		top: 0;
		z-index: 3;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 2px 4px 8px;
		background: var(--bgfx);
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.rail-head .hint {
		opacity: 0.7;
	}

	.add {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 10px;
		border: 1px dashed var(--line);
		border-radius: var(--radius-card);
		background: transparent;
		color: var(--ink3);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition:
			color var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease);
	}

	.add:hover {
		color: var(--ink);
		border-color: var(--ink3);
	}

	.add:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}

	/* The workbench manages its own two-column scroll (a scrolling bench, an independently scrolling
	   mind), so the detail just gives it the pane's full, bounded height to fill. */
	.detail {
		min-height: 0;
		height: 100%;
		overflow: hidden;
	}

	/* On a phone there is no room for a side rail: stack it above the detail as a horizontal strip. */
	@media (max-width: 720px) {
		.focus {
			grid-template-columns: 1fr;
			grid-template-rows: auto minmax(0, 1fr);
			padding: var(--sp-4);
			gap: var(--sp-4);
		}

		.rail {
			flex-direction: row;
			height: auto;
			max-height: 168px;
			overflow-x: auto;
			overflow-y: hidden;
		}

		.rail-head {
			position: static;
			flex-direction: column;
			justify-content: center;
			flex: none;
		}

		.rail :global(.card) {
			width: 190px;
			flex: none;
		}

		.rail-wrap::before,
		.rail-wrap::after {
			display: none;
		}
	}
</style>
