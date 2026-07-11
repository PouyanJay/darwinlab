<!--
  The bench page — the app's only screen.

  Five worlds open side by side, each one sense further along the ladder (README §8), all prewarmed
  so the bench opens already competent and the learning curves have something to say. Reading left
  to right IS the argument: survival leaps when a brain learns which WAY the threat is, and then
  stops leaping no matter how many more senses you bolt on.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import TopBar from '$lib/components/topbar/TopBar.svelte';
	import TurboPill from '$lib/components/topbar/TurboPill.svelte';
	import FieldNote from '$lib/components/bench/FieldNote.svelte';
	import WorldTile from '$lib/components/bench/WorldTile.svelte';
	import ConditionsModal from '$lib/components/conditions/ConditionsModal.svelte';
	import BrainInspector from '$lib/components/inspector/BrainInspector.svelte';
	import FooterPill from '$lib/components/common/FooterPill.svelte';
	import { bench } from '$lib/state';
	import { DEFAULT_WORLDS, newWorldConfig, MAX_GENERATIONS } from '$lib/engine';

	const PREWARM_GENERATIONS = 15;

	onMount(() => {
		bench.init({
			configs: DEFAULT_WORLDS,
			prewarmGenerations: PREWARM_GENERATIONS,
			maxGenerations: MAX_GENERATIONS.default
		});
		return () => bench.destroy();
	});

	/** The lowest "World N" nobody is using — so removing a world can't make two share a name. */
	function nextWorldName(): string {
		const taken = new Set(bench.worlds.map((entry) => entry.world.cfg.name));
		let n = bench.worlds.length + 1;
		while (taken.has(`World ${n}`)) n++;
		return `World ${n}`;
	}

	function addWorld() {
		bench.addWorld(newWorldConfig(nextWorldName(), bench.nextAccent()));
	}

	// One dialog, for whichever world asked for it. It resolves to `undefined` the instant that world
	// is removed, so the dialog cannot outlive the thing it edits.
	const editing = $derived(
		bench.conditionsWorldId ? bench.find(bench.conditionsWorldId) : undefined
	);

	// Likewise the inspector: one selection across the bench, and it goes when its world does.
	const inspecting = $derived(bench.selection ? bench.find(bench.selection.worldId) : undefined);

	/**
	 * Space plays/pauses — but ONLY when it isn't already the focused control's key.
	 *
	 * Space is how a focused button is pressed and how a radio is chosen. Calling preventDefault on
	 * it while a control has focus cancels that activation, so Space on the theme toggle used to
	 * pause the sim instead of switching the theme. The shortcut therefore stands down for anything
	 * focusable that Space already means something to, and only claims the key on the bare page.
	 */
	const SPACE_IS_SPOKEN_FOR =
		'button, input, textarea, select, a, [role="radio"], [contenteditable]';

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== ' ') return;
		const target = event.target as HTMLElement | null;
		if (target?.closest(SPACE_IS_SPOKEN_FOR)) return;
		event.preventDefault();
		bench.togglePlay();
	}
</script>

<svelte:head><title>Darwin Lab</title></svelte:head>
<svelte:window {onkeydown} />

<div class="app">
	<TopBar onaddworld={addWorld} />
	<TurboPill />

	<div class="banner">
		<FieldNote />
	</div>

	<main>
		{#each bench.worlds as entry, index (entry.id)}
			<WorldTile {entry} index={index + 1} />
		{/each}

		<button class="ghost" onclick={addWorld}>+ Add world</button>
	</main>

	{#if editing}
		<ConditionsModal entry={editing} onclose={() => bench.closeConditions()} />
	{/if}

	{#if bench.selection && inspecting}
		<BrainInspector selection={bench.selection} entry={inspecting} />
	{/if}

	<FooterPill />
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.banner {
		margin: var(--sp-6) var(--sp-8) 0;
	}

	main {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
		gap: var(--sp-7);
		align-content: start;
		padding: var(--sp-7) var(--sp-8) 78px; /* the footer pill sits in that bottom margin */
	}

	/* The one card that holds nothing: an empty slot inviting a new experiment. */
	.ghost {
		min-height: 240px;
		display: grid;
		place-items: center;
		border: 1.5px dashed var(--line);
		border-radius: var(--radius-card);
		background: transparent;
		color: var(--ink3);
		font-size: 13px;
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition:
			color var(--dur) var(--ease),
			border-color var(--dur) var(--ease);
	}

	.ghost:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
</style>
