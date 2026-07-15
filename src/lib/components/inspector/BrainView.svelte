<!--
  Two ways to read one evolved mind, in a single slot.

  "Escape map" is the RULE — the policy `probePolicy` swept over every shark position; "Wiring" is
  the MACHINE — the 68 weights drawn as a graph. Same brain, two questions: what does it do, and how
  is it built. A segmented control switches between them; the map leads, because it is the one a
  human can read without knowing what a weight is.
-->
<script lang="ts">
	import Segmented from '../common/Segmented.svelte';
	import EscapeMap from './EscapeMap.svelte';
	import BrainCanvas from './BrainCanvas.svelte';
	import type { WorldEntry } from '$lib/state';
	import { SCENARIO } from '$lib/lab/scenario';

	interface Props {
		entry: WorldEntry;
	}

	let { entry }: Props = $props();

	type View = 'strategy' | 'wiring';
	let view = $state<View>('strategy');
	// The RULE segment takes the scenario's name ("Escape map"); "Wiring" is the network graph, which
	// is scenario-independent, so it stays generic.
	const options = [
		{ value: 'strategy' as const, label: SCENARIO.policyMap.name },
		{ value: 'wiring' as const, label: 'Wiring' }
	];
</script>

<div class="switch">
	<Segmented {options} value={view} onchange={(v) => (view = v)} label="How to read the brain" />
</div>

{#if view === 'strategy'}
	<EscapeMap {entry} />
{:else}
	<BrainCanvas {entry} />
{/if}

<style>
	.switch {
		display: flex;
		justify-content: flex-end;
		margin-bottom: var(--sp-3);
	}
</style>
