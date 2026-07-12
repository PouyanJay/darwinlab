<!--
  The Brain Inspector — the product's soul: a real evolved mind, thinking, while you watch it swim.

  It is a NON-modal drawer (see Drawer), and that is the whole point: the bench behind it stays live,
  so the fish you are inspecting is still being hunted while you read its brain. Everything in here
  is the fish's own — its senses this frame, its 68 weights, the motor outputs those weights just
  produced. Nothing is illustrative.

  It closes when the fish stops existing, because the store lets a dead selection go (a hand-picked
  fish is not silently swapped for another one). A ★ Champion selection instead follows the lineage
  into the next generation, so the panel keeps showing "the best brain alive" as it improves.
-->
<script lang="ts">
	import Drawer from '../common/Drawer.svelte';
	import SenseBars from './SenseBars.svelte';
	import BrainCanvas from './BrainCanvas.svelte';
	import MotorOutputs from './MotorOutputs.svelte';
	import AblationCard from './AblationCard.svelte';
	import IntelligenceLadder from './IntelligenceLadder.svelte';
	import SharkPanel from './SharkPanel.svelte';
	import { bench } from '$lib/state';
	import type { Selection, WorldEntry } from '$lib/state';

	interface Props {
		selection: Selection;
		entry: WorldEntry;
	}

	let { selection, entry }: Props = $props();

	const fish = $derived(selection.type === 'fish');
	const title = $derived(fish ? 'Fish mind — live' : 'Shark — no brain');
	const subtitle = $derived(
		fish ? `one real evolved brain in “${entry.config.name}”` : 'a rule-based hunter, on purpose'
	);

	const champion = $derived(
		entry.stats.championFitness ? `${entry.stats.championFitness.toFixed(1)}s` : '—'
	);
</script>

<!-- takeFocus: a selection made by the tank's keyboard walk keeps the walker's focus — a click
     or the ★ Champion button still moves the reader into the panel, announcement and all. -->
<Drawer
	open
	live={fish}
	{title}
	{subtitle}
	takeFocus={!bench.walkSelection}
	onclose={() => bench.clearSelection()}
>
	{#if fish}
		<div class="stats">
			<div class="stat">
				<span class="eyebrow" id="stat-lived">lived</span>
				<b class="tabular" aria-labelledby="stat-lived">{bench.mind.lived.toFixed(1)}s</b>
			</div>
			<div class="stat">
				<span class="eyebrow" id="stat-generation">generation</span>
				<b class="tabular" aria-labelledby="stat-generation">{entry.stats.gen}</b>
			</div>
			<div class="stat">
				<span class="eyebrow" id="stat-champion">champion</span>
				<b class="tabular gold" aria-labelledby="stat-champion">{champion}</b>
			</div>
		</div>

		<div class="section">
			<div class="field-label">What it senses right now</div>
			<div class="bars"><SenseBars {entry} /></div>
		</div>

		<div class="section"><BrainCanvas {entry} /></div>

		<div class="section">
			<div class="field-label">Motor outputs</div>
			<MotorOutputs />
		</div>

		<AblationCard {entry} />

		<div class="section"><IntelligenceLadder {entry} /></div>
	{:else}
		<SharkPanel />
	{/if}
</Drawer>

<style>
	.stats {
		display: flex;
		gap: 7px;
		margin-top: var(--sp-5);
	}

	.stat {
		flex: 1;
		padding: var(--sp-3) var(--sp-4);
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		background: var(--panel2);
	}

	.stat b {
		display: block;
		font-size: var(--fs-stat);
		font-weight: var(--fw-semibold);
	}

	/* The champion's time is the bar this fish is measured against, so it wears the champion's gold. */
	.gold {
		color: var(--gold-ink); /* gold AS TEXT — see tokens.css */
	}

	.section {
		margin-top: 17px;
	}

	.bars {
		margin-top: 9px;
	}
</style>
