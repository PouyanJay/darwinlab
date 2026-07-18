<!--
  The bench page — the app's only screen.

  It opens on the INTRO: the product's claim and method, full-screen, which the first interaction
  fades away to reveal the platform already running underneath. Behind it, a shell in three parts:
  the top bar says what this is, the sidebar is everything you can do to it, and the bench is the
  experiment itself — the lineage canvas, one node per environment, each a living population with
  its own controls and its own evidence.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import TopBar from '$lib/components/topbar/TopBar.svelte';
	import TurboPill from '$lib/components/topbar/TurboPill.svelte';
	import Sidebar from '$lib/components/shell/Sidebar.svelte';
	import Intro from '$lib/components/intro/Intro.svelte';
	import FirstRunHint from '$lib/components/bench/FirstRunHint.svelte';
	import LineageCanvas from '$lib/components/bench/LineageCanvas.svelte';
	import FocusView from '$lib/components/bench/FocusView.svelte';
	import ConditionsModal from '$lib/components/conditions/ConditionsModal.svelte';
	import BrainInspector from '$lib/components/inspector/BrainInspector.svelte';
	import StoryMode from '$lib/components/story/StoryMode.svelte';
	import FooterPill from '$lib/components/common/FooterPill.svelte';
	import { bench, shell, story, theme, prefersReducedMotion } from '$lib/state';
	import { DEFAULT_WORLDS, newWorldConfig, MAX_GENERATIONS_DEFAULT } from '$lib/engine';
	import { PREWARM_GENERATIONS } from '$lib/lab/scenario';

	// A paused bench repaints only on demand (see bench.requestPaint) — but the palette and the
	// reduced-motion flag change what the pixels look like WITHOUT going through the store, so
	// their flips owe the canvases one repaint. Reading them is what subscribes this effect;
	// `void` marks them as read-for-tracking only.
	$effect(() => {
		void theme.name;
		void prefersReducedMotion();
		bench.requestPaint();
	});

	onMount(() => {
		const stopWatchingViewport = shell.init();
		bench.init({
			configs: DEFAULT_WORLDS,
			prewarmGenerations: PREWARM_GENERATIONS,
			maxGenerations: MAX_GENERATIONS_DEFAULT
		});
		return () => {
			bench.destroy();
			stopWatchingViewport();
		};
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

	// The intro is up until the first interaction; the platform runs (and prewarms) underneath it the
	// whole time, so dismissing it reveals a live bench rather than starting one.
	let entered = $state(false);

	/**
	 * How much of the left edge the sidebar is holding.
	 *
	 * The three things that float over the bench (the disclaimer, the first-run hint, the training
	 * pill) are positioned against the VIEWPORT, which no longer starts where the bench does. Without
	 * this they anchor under the sidebar and read as centred on a page they are not centred on. An
	 * overlay panel is not counted: it is on top of the bench, not beside it.
	 */
	const gutter = $derived(shell.open && !shell.narrow ? `${shell.width}px` : 'var(--rail-width)');

	// One dialog, for whichever world asked for it. It resolves to `undefined` the instant that world
	// is removed, so the dialog cannot outlive the thing it edits.
	const editing = $derived(
		bench.conditionsWorldId ? bench.find(bench.conditionsWorldId) : undefined
	);

	// Likewise the inspector: one selection across the bench, and it goes when its world does.
	const inspecting = $derived(bench.selection ? bench.find(bench.selection.worldId) : undefined);

	// The focus view takes over the bench when a world is expanded — but only while that world still
	// exists. A focusedId left pointing at a removed world falls straight back to the canvas.
	const focusing = $derived(bench.focusedId ? bench.find(bench.focusedId) : undefined);

	/**
	 * Space plays/pauses — but ONLY when it isn't already the focused control's key.
	 *
	 * Space is how a focused button is pressed and how a radio is chosen. Calling preventDefault on
	 * it while a control has focus cancels that activation, so Space on the theme toggle used to
	 * pause the sim instead of switching the theme. The shortcut therefore stands down for anything
	 * focusable that Space already means something to, and only claims the key on the bare page.
	 */
	const SPACE_IS_SPOKEN_FOR =
		'button, input, textarea, select, a, [role="radio"], [role="separator"], [contenteditable]';

	function onkeydown(event: KeyboardEvent) {
		// While the intro is up, every key belongs to it (any key is "let me in") — the page's own
		// shortcuts stand down, or the keypress that enters the lab would also pause the sim.
		if (!entered) return;

		// Esc shuts the control panel where it is an overlay — the same key that closes every other
		// thing this app puts over the bench.
		if (event.key === 'Escape' && shell.narrow && shell.overlayOpen && !story.active) {
			shell.closeOverlay();
			return;
		}

		if (event.key !== ' ') return;
		if (story.active) return; // the film has its own transport, and it owns the keyboard
		const target = event.target as HTMLElement | null;
		if (target?.closest(SPACE_IS_SPOKEN_FOR)) return;
		event.preventDefault();
		bench.togglePlay();
	}
</script>

<svelte:head><title>Darwin Lab</title></svelte:head>
<svelte:window {onkeydown} />

<!-- inert while a full-screen takeover is up — the intro or a playing film. A keyboard user must
     not be able to Tab onto controls they cannot see and remove a world mid-presentation. -->
<div class="app" inert={story.active || !entered} style:--shell-gutter={gutter}>
	<TopBar />
	<TurboPill />

	<div class="shell">
		<Sidebar onaddworld={addWorld} onplaystory={() => bench.playStory()} />

		<!-- The bench IS the canvas: the family tree takes the full height under the top bar — unless a
		     world has been expanded, when the focus view (one world large + a rail of the rest) takes
		     its place. -->
		<div class="bench">
			<main>
				{#if focusing}
					<FocusView onaddworld={addWorld} />
				{:else}
					<LineageCanvas onaddworld={addWorld} />
				{/if}
			</main>
		</div>
	</div>

	{#if editing}
		<ConditionsModal entry={editing} onclose={() => bench.closeConditions()} />
	{/if}

	{#if bench.selection && inspecting}
		<BrainInspector selection={bench.selection} entry={inspecting} />
	{/if}

	<FooterPill />
	<FirstRunHint />
</div>

<!-- OUTSIDE the app, deliberately: the app above is `inert` while a takeover is up, and a takeover
     that lived inside the thing it suppresses would suppress itself. -->
<StoryMode />
{#if !entered}
	<Intro ondismiss={() => (entered = true)} />
{/if}

<style>
	.app {
		display: flex;
		flex-direction: column;
		/* A canvas app is exactly the viewport tall: the tree gets a bounded height to fill rather than
		   growing the page. (dvh so mobile browser chrome doesn't crop the low controls.) */
		height: 100dvh;
	}

	.shell {
		flex: 1;
		/* Bound the row to the viewport: without this the flexbox min-height:auto rule lets a tall child
		   (the focus view's rail, ~2900px with a big bench) push .shell past the screen instead of the
		   child scrolling inside it. The pannable canvas never exposed this — its content height is
		   fixed — but the scrolling rail does. */
		min-height: 0;
		display: flex;
		align-items: stretch;
	}

	.bench {
		flex: 1;
		min-width: 0; /* the canvas may shrink; it must never push the sidebar off its width */
		min-height: 0;
		display: flex;
		flex-direction: column;
		/* No padding: the canvas IS the bench, edge to edge — not a card sitting on a layer. */
	}

	/* The canvas host fills the whole bench — the tree gets the room, not a scroll. */
	main {
		flex: 1;
		min-height: 0;
		display: flex;
	}
</style>
