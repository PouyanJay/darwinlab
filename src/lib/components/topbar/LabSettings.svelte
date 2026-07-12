<!--
  Lab settings — the knobs that belong to the bench rather than to any one world.

  Only one so far, and it is the one that decides whether the product has a second act: how many
  generations a world trains for before it is DEPLOYED (see MAX_GENERATIONS in engine/defaults.ts).
  The panel spells out what that means in its own copy, because "max generations" on its own reads
  like a slider about performance rather than the moment evolution stops for good.

  It uses the native popover: light-dismiss and Esc come free, and it lives in the top layer without
  a z-index argument with the drawer.
-->
<script lang="ts">
	import Button from '../common/Button.svelte';
	import Slider from '../common/Slider.svelte';
	import { bench } from '$lib/state';
	import { MAX_GENERATIONS } from '$lib/engine';

	const limit = $derived(bench.maxGenerations);

	/** "never" is not a smaller number than 5 — it is a different answer, and it reads like one. */
	const describe = (generation: number) => (generation === 0 ? 'never' : `gen ${generation}`);
</script>

<Button popovertarget="lab-settings" aria-label="lab settings" title="lab settings">
	<span aria-hidden="true">⚙</span>
</Button>

<div popover id="lab-settings" class="panel" aria-labelledby="lab-settings-title">
	<h2 id="lab-settings-title">Lab settings</h2>

	<Slider
		label="Deploy at"
		value={limit}
		{...MAX_GENERATIONS}
		format={describe}
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

	<h3>Keyboard</h3>
	<dl class="keys">
		<div>
			<dt><kbd>Space</kbd></dt>
			<dd>play / pause</dd>
		</div>
		<div>
			<dt><kbd>←</kbd> <kbd>→</kbd></dt>
			<dd>walk a focused tank's creatures · move between story scenes</dd>
		</div>
		<div>
			<dt><kbd>Esc</kbd></dt>
			<dd>close a dialog · put a creature down · leave the story</dd>
		</div>
	</dl>
</div>

<style>
	.panel {
		position: fixed;
		top: calc(var(--topbar-height) + var(--sp-2));
		right: var(--sp-8);
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

	h3 {
		margin: var(--sp-6) 0 var(--sp-3);
		font-size: var(--fs-eyebrow);
		font-weight: var(--fw-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--ink3);
	}

	.keys {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		margin: 0;
	}

	.keys div {
		display: flex;
		align-items: baseline;
		gap: var(--sp-4);
	}

	.keys dt {
		flex: none;
		min-width: 52px;
	}

	.keys dd {
		margin: 0;
		font-size: var(--fs-sm);
		line-height: var(--leading-body);
		color: var(--ink2);
	}

	kbd {
		padding: 1px 5px;
		border: 1px solid var(--line);
		border-bottom-width: 2px;
		border-radius: 4px;
		background: var(--panel2);
		font-family: inherit;
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		color: var(--ink);
	}
</style>
