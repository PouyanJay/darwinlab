<!--
  Phase 2 proof page — the walking skeleton for the bench.

  Proves the whole path works end-to-end: engine → visibility-safe loop → runes store →
  DPR-aware canvas → pixels, with live controls. It is deliberately unstyled scaffolding;
  Phase 3 replaces it with the real design system and Phase 4 with the true bench grid.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Tank from '$lib/components/bench/Tank.svelte';
	import { bench, theme, type Speed } from '$lib/state';
	import { DEFAULT_WORLDS } from '$lib/engine';

	const PREWARM_GENERATIONS = 15;
	const SPEEDS: Speed[] = [0.5, 1, 2];
	const speedLabel = (s: Speed) => (s === 0.5 ? '½×' : `${s}×`);

	onMount(() => {
		theme.init();
		// Phase 2 proves one world end-to-end; the full 5-world bench grid is Phase 4.
		bench.init({
			configs: [DEFAULT_WORLDS[2]], // "Direction" — the sense that actually pays
			prewarmGenerations: PREWARM_GENERATIONS
		});
		return () => bench.destroy();
	});

	const entry = $derived(bench.worlds[0]);
</script>

<svelte:head><title>Darwin Lab</title></svelte:head>

<!-- Space toggles play/pause, unless the user is typing. -->
<svelte:window
	onkeydown={(e) => {
		const el = e.target as HTMLElement | null;
		if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return;
		if (e.key === ' ') {
			e.preventDefault();
			bench.togglePlay();
		}
	}}
/>

<main>
	<header>
		<h1>Darwin Lab</h1>
		<span class="chip">Phase 2 · sim runtime</span>

		<div class="spacer"></div>

		<span class="readout tabular">
			<b>{bench.generationsEvolved}</b> generations evolved
		</span>

		<button class="primary" onclick={() => bench.togglePlay()}>
			{bench.running ? 'Pause' : 'Evolve'}
		</button>

		<div class="segmented" role="group" aria-label="simulation speed">
			{#each SPEEDS as s (s)}
				<button
					class:selected={bench.speed === s}
					aria-pressed={bench.speed === s}
					onclick={() => bench.setSpeed(s)}
				>
					{speedLabel(s)}
				</button>
			{/each}
		</div>

		<button onclick={() => bench.trainTo(bench.generationsEvolved + 25)}>⏩ Train +25 gens</button>
		<button onclick={() => theme.toggle()} aria-label="switch theme">
			{theme.name === 'light' ? '◐' : '◑'}
		</button>
	</header>

	{#if bench.turboTarget !== null}
		<p class="turbo" role="status">training to generation {bench.turboTarget}…</p>
	{/if}

	{#if entry}
		<section class="tile">
			<div class="tile-head">
				<b>{entry.world.cfg.name}</b>
				<span class="chip tabular">Gen {entry.stats.gen}</span>
				<div class="spacer"></div>
				<span class="stat tabular">
					<span class="muted">alive</span>
					<b>{entry.stats.alive}</b>
					<b class="eaten">−{entry.stats.eaten}</b>
				</span>
				<span class="stat tabular">
					<span class="muted">survival</span>
					<b>{entry.stats.survivalPct}%</b>
				</span>
			</div>

			<div class="tank">
				<Tank {entry} />
			</div>
		</section>
	{/if}

	<p class="footnote">real neuroevolution · a teaching caricature, not biology</p>
</main>

<style>
	main {
		min-height: 100vh;
		padding: 16px 20px 40px;
	}

	header {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		padding-bottom: 14px;
		border-bottom: 1px solid var(--line);
	}

	h1 {
		margin: 0;
		font-size: 18px;
		letter-spacing: -0.01em;
	}

	.spacer {
		flex: 1;
	}

	.chip,
	.readout {
		font-size: 11.5px;
		color: var(--ink2);
		background: var(--chip);
		padding: 4px 8px;
		border-radius: 20px;
	}

	.readout b {
		color: var(--ink);
	}

	button {
		font: inherit;
		font-size: 12.5px;
		font-weight: 600;
		padding: 7px 12px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--panel);
		color: var(--ink);
		cursor: pointer;
	}

	button:hover {
		background: var(--chip);
	}

	button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	button.primary {
		background: var(--btn);
		color: var(--btnink);
		border-color: transparent;
		min-width: 88px;
	}

	.segmented {
		display: flex;
		gap: 2px;
		padding: 3px;
		background: var(--chip);
		border-radius: 10px;
	}

	.segmented button {
		border: none;
		background: transparent;
		padding: 4px 10px;
	}

	.segmented button.selected {
		background: var(--panel);
		box-shadow: var(--shadow);
	}

	.turbo {
		margin: 12px 0 0;
		font-size: 12px;
		color: var(--ink2);
	}

	.tile {
		margin-top: 16px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 20px;
		box-shadow: var(--shadow);
		overflow: hidden;
		max-width: 760px;
	}

	.tile-head {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 15px;
	}

	.stat {
		display: inline-flex;
		align-items: baseline;
		gap: 5px;
		font-size: 13px;
	}

	.muted {
		font-size: 9.5px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--ink3);
	}

	.eaten {
		color: var(--danger);
		font-size: 11px;
	}

	/* The tank owns its own height; the canvas fills it. */
	.tank {
		height: 340px;
		margin: 0 9px 12px;
	}

	.footnote {
		margin-top: 24px;
		font-size: 10.5px;
		color: var(--ink3);
	}
</style>
