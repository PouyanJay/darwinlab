<!--
  Lab settings — the knobs that belong to the bench rather than to any one world.

  Only one so far, and it is the one that decides whether the product has a second act: how many
  generations a world trains for before it is DEPLOYED. Deployment is not a pause. Evolution stops,
  the resets stop, and the population you spent those generations breeding has to survive on its own
  with nothing coming to save it. The panel says so, because "max generations" on its own sounds
  like a slider about performance.

  It uses the native popover: light-dismiss and Esc come free, and it lives in the top layer without
  a z-index argument with the drawer.
-->
<script lang="ts">
	import Button from '../common/Button.svelte';
	import Slider from '../common/Slider.svelte';
	import { bench } from '$lib/state';
	import { MAX_GENERATIONS } from '$lib/engine';

	const limit = $derived(bench.maxGenerations);
	const label = $derived(limit === 0 ? 'never' : `gen ${limit}`);
</script>

<Button popovertarget="lab-settings" aria-label="lab settings" title="lab settings">
	<span aria-hidden="true">⚙</span>
</Button>

<div popover id="lab-settings" class="panel">
	<h2>Lab settings</h2>

	<Slider
		label="Deploy at"
		value={limit}
		{...MAX_GENERATIONS}
		format={() => label}
		onchange={(value) => bench.setMaxGenerations(value)}
	/>

	<p class="note">
		{#if limit === 0}
			The bench keeps evolving forever. Nothing is ever deployed, which is what you want while you
			are still changing the experiment.
		{:else}
			At generation {limit}, training stops for good. No more generations, no more respawns — the
			population that is in the water is the one that has to survive, and you watch how long it
			lasts.
		{/if}
	</p>
</div>

<style>
	.panel {
		position: fixed;
		inset: auto var(--sp-8) auto auto;
		top: calc(var(--topbar-height) + var(--sp-2));
		width: 300px;
		padding: var(--sp-6);
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background: var(--panel);
		color: var(--ink);
		box-shadow: var(--shadow-drawer);
		animation: fade-up var(--dur-fast) var(--ease) both;
	}

	h2 {
		margin: 0 0 var(--sp-5);
		font-family: var(--font-display);
		font-size: var(--fs-title);
		font-weight: var(--fw-semibold);
	}

	.note {
		margin: var(--sp-4) 0 0;
		font-size: var(--fs-md);
		line-height: var(--leading-body);
		color: var(--ink2);
	}
</style>
