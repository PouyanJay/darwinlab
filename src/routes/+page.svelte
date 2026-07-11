<!--
  The bench page — the app's only screen.

  Phase 3 builds the SHELL around the bench: top bar, field note, turbo pill, footer. What sits in
  the middle is still the Phase 2 proof — the prewarmed world in a plain tile — because the real
  world tile (header, sense pills, curves, conditions, decay) is Phase 4's job. When that lands it
  replaces `<section class="tile">` and nothing else on this page has to move.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import TopBar from '$lib/components/topbar/TopBar.svelte';
	import TurboPill from '$lib/components/topbar/TurboPill.svelte';
	import FieldNote from '$lib/components/bench/FieldNote.svelte';
	import Tank from '$lib/components/bench/Tank.svelte';
	import Chip from '$lib/components/common/Chip.svelte';
	import FooterPill from '$lib/components/common/FooterPill.svelte';
	import { bench } from '$lib/state';
	import { DEFAULT_WORLDS, newWorldConfig } from '$lib/engine';

	const PREWARM_GENERATIONS = 15;

	onMount(() => {
		// Phase 2 proved one world end-to-end; the five-world default bench is Phase 4.
		bench.init({
			configs: [DEFAULT_WORLDS[2]], // "Direction" — the sense that actually pays
			prewarmGenerations: PREWARM_GENERATIONS
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
		{#each bench.worlds as entry (entry.id)}
			<section class="tile">
				<header>
					<b class="name">{entry.world.cfg.name}</b>
					<Chip tabular>Gen {entry.stats.gen}</Chip>
					<div class="spacer"></div>
					<span class="stat">
						<span class="eyebrow">alive</span>
						<span class="value">
							<b class="tabular" data-testid="alive">{entry.stats.alive}</b>
							<b class="eaten tabular" data-testid="eaten">−{entry.stats.eaten}</b>
						</span>
					</span>
					<span class="stat">
						<span class="eyebrow">survival</span>
						<span class="value">
							<b class="tabular" data-testid="survival">{entry.stats.survivalPct}%</b>
						</span>
					</span>
				</header>

				<div class="tank">
					<Tank {entry} />
				</div>
			</section>
		{/each}
	</main>

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

	.tile {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--line);
		border-radius: var(--radius-card);
		background: var(--panel);
		box-shadow: var(--shadow);
		overflow: hidden;
		animation: fade-up var(--dur-slow) var(--ease) both;
		transition: transform var(--dur) var(--ease);
	}

	.tile:hover {
		transform: translateY(-2px);
	}

	header {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: var(--sp-4) var(--sp-5) 7px;
	}

	.name {
		font-family: var(--font-display);
		font-size: var(--fs-name);
		font-weight: var(--fw-semibold);
	}

	.spacer {
		flex: 1;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.value {
		display: flex;
		align-items: baseline;
		gap: 5px;
		font-size: var(--fs-stat);
		font-weight: var(--fw-semibold);
	}

	.eaten {
		font-size: var(--fs-sm);
		color: var(--danger);
	}

	/* The tank owns its own height; the canvas fills it. */
	.tank {
		height: 300px;
		margin: 0 9px 12px;
	}
</style>
