<!--
  Champion clones: three ways to fill the tank, and they are three different experiments.

  ⚠️ It makes the behaviour LEGIBLE, not better, and the UI must never imply otherwise: twenty copies
  of one policy do the same thing at the same time, so the rule stops being an average of a smear.
  Cloning the best SURVIVOR is not cloning the best FLEER (fitness is seconds survived, and seconds
  can be bought by keeping distance) — measured, clones score no better on flee error than the crowd.

    Off      the population, as it evolved.
    Frozen   the real run is held; a sealed tank of clones swims in its place until you switch it off.
    Live     the run keeps evolving underneath, re-cloned every generation, so the strategy sharpens.
-->
<script lang="ts">
	import Chip from '../common/Chip.svelte';
	import Segmented from '../common/Segmented.svelte';
	import { bench, type ExhibitMode, type WorldEntry } from '$lib/state';

	interface Props {
		entry: WorldEntry;
	}

	let { entry }: Props = $props();

	const MODES: { value: ExhibitMode; label: string }[] = [
		{ value: 'off', label: 'Off' },
		{ value: 'frozen', label: 'Frozen' },
		{ value: 'live', label: 'Live' }
	];

	const mode = $derived(bench.exhibitMode(entry.id));

	/** A brain is crowned only at a generation boundary, so gen 0 has nothing to clone. */
	const hasChampion = $derived(entry.stats.gen > 0);

	/**
	 * One line for every mode, so switching does not change the SHAPE of the panel — only its words.
	 * (Off used to show nothing, which made it look like a different, broken control.)
	 */
	const line = $derived.by(() => {
		if (!hasChampion) return 'Available once this world finishes its first generation.';
		if (mode === 'frozen')
			return 'The run is held. These are copies of the best brain of the last generation: its rule, not the average of a smear.';
		if (mode === 'live')
			return 'Copies of the best brain, re-cloned each generation. The run keeps evolving underneath.';
		return 'The population as it evolved: the best brains and their cloud of mutants.';
	});

	function choose(next: ExhibitMode) {
		bench.setExhibit(entry.id, next);
	}
</script>

<div class="exhibit">
	<div class="row">
		<span class="field-label" aria-hidden="true">Champion clones</span>
		<Segmented
			label="champion clones"
			options={MODES}
			value={mode}
			disabled={!hasChampion}
			onchange={(next) => choose(next)}
		/>
	</div>

	<p
		class="line"
		class:exhibiting={mode !== 'off' && hasChampion}
		role="status"
		data-testid="exhibit-line"
	>
		{#if mode !== 'off' && hasChampion}
			<Chip tone="accent" style="--chip-accent: {entry.config.accent}">exhibit</Chip>
		{/if}
		<span>{line}</span>
	</p>
</div>

<style>
	/* No chrome of its own: it is the head of the clones card, not a card inside it. The border and
	   padding live on .clones (Workbench), so the segmented control, the description and the buttons
	   read as one panel rather than a box floating inside another box. */
	.exhibit {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
	}

	.line {
		display: flex;
		align-items: flex-start;
		gap: var(--sp-3);
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink3);
	}

	/* While clones are up, the line is a live warning, so it reads a notch louder than an idle hint. */
	.line.exhibiting {
		color: var(--ink2);
	}
</style>
