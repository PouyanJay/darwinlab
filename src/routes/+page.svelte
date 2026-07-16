<!--
  The bench page — the app's only screen.

  A shell in three parts: the top bar says what this is, the sidebar is everything you can do to it,
  and the bench is the experiment itself — one card per environment, each a living population with
  its own controls and its own evidence.

  The cards are SIZED, not stretched. A tank has a shape (the world is 640×400), and a card stretched
  to whatever a monitor happens to be wide paints a letterbox of empty water around it. So the grid
  runs at most three across, the cards keep their width, and a bench of one gives that one card the
  room — the layout follows the experiment, not the window.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import TopBar from '$lib/components/topbar/TopBar.svelte';
	import TurboPill from '$lib/components/topbar/TurboPill.svelte';
	import Sidebar from '$lib/components/shell/Sidebar.svelte';
	import FieldNote from '$lib/components/bench/FieldNote.svelte';
	import FirstRunHint from '$lib/components/bench/FirstRunHint.svelte';
	import WorldTile from '$lib/components/bench/WorldTile.svelte';
	import ConditionsModal from '$lib/components/conditions/ConditionsModal.svelte';
	import BrainInspector from '$lib/components/inspector/BrainInspector.svelte';
	import StoryMode from '$lib/components/story/StoryMode.svelte';
	import FooterPill from '$lib/components/common/FooterPill.svelte';
	import Icon from '$lib/components/common/Icon.svelte';
	import { bench, shell, story, theme, prefersReducedMotion } from '$lib/state';
	import { newWorldConfig } from '$lib/engine';
	import { DEFAULT_EXHIBIT } from '$lib/lab/exhibits';

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
		bench.loadExhibit(DEFAULT_EXHIBIT);
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

	/**
	 * How wide the bench is allowed to run, and how wide a card is inside it.
	 *
	 * Three across is the ceiling because a fourth card makes every tank too small to watch a fish in
	 * — and watching is the entire point. Below the ceiling the cards do NOT divide the window between
	 * them; they take the width their contents deserve and the bench centres what is left. A single
	 * environment is therefore a big single card, not a 2000px-wide sliver of water.
	 *
	 * `auto-fit` then reduces the columns for real (a narrow window, or a dragged-wide sidebar) rather
	 * than letting the cards squeeze: the cap sets the maximum, the viewport sets the actual.
	 */
	const MAX_COLUMNS = 3;

	/**
	 * How wide a card is, given how many are sharing the row. Fewer environments on the bench means a
	 * bigger tank in each — one on its own is a card you can actually watch a fish in, not a card
	 * stretched to the width of a monitor.
	 */
	const CARD_WIDTH: Record<number, number> = { 1: 780, 2: 580, 3: 470 };

	const columns = $derived(Math.min(MAX_COLUMNS, Math.max(1, bench.worlds.length)));
	const cardWidth = $derived(CARD_WIDTH[columns]);

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

<!-- inert while a film is playing: the bench is behind a full-screen takeover, and a keyboard user
     must not be able to Tab onto controls they cannot see and remove a world mid-presentation. -->
<div class="app" inert={story.active} style:--shell-gutter={gutter}>
	<TopBar />
	<TurboPill />

	<div class="shell">
		<Sidebar onaddworld={addWorld} onplaystory={() => bench.playStory()} />

		<!-- One measure for the whole column: the note, the cards and the empty slot share an edge. -->
		<div class="bench" style:--columns={columns} style:--card="{cardWidth}px">
			<div class="banner"><FieldNote /></div>

			<main>
				<div class="grid">
					{#each bench.worlds as entry, index (entry.id)}
						<WorldTile {entry} index={index + 1} />
					{/each}
				</div>

				<!--
					OUTSIDE the grid, not a cell in it and not a row spanning it.

					It was a cell that spanned every column — and that is what broke the sizing. `auto-fit`
					only collapses a track when NOTHING occupies it; a full-width item occupies them all, so
					the empty tracks stayed open and a bench of one painted its single card in a 380px track
					with the rest of the row left blank. The card never grew, and the layout never centred.
					Out here it cannot hold a track open, so one world really is one wide, centred card.

					It stays inside <main> all the same: a button loose in a bare <div> is content no
					landmark owns, which is content a screen reader cannot situate (the axe `region` rule).
				-->
				<button class="ghost" onclick={addWorld}>
					<Icon name="plus" size={15} />
					<span>Add environment</span>
				</button>
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

<!-- OUTSIDE the app, deliberately: the app above is `inert` while a film plays, and a takeover that
     lived inside the thing it suppresses would suppress itself. -->
<StoryMode />

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.shell {
		flex: 1;
		display: flex;
		align-items: stretch;
	}

	.bench {
		flex: 1;
		min-width: 0; /* the grid may shrink; it must never push the sidebar off its width */
		display: flex;
		flex-direction: column;
		gap: var(--sp-7);
		padding: var(--sp-6) var(--sp-7) 78px; /* the footer pill sits in that bottom margin */
	}

	.banner,
	main {
		width: 100%;
		/* The cap, in one line: N cards and the gaps between them. Everything else is centring. */
		max-width: calc(var(--columns) * var(--card) + (var(--columns) - 1) * var(--sp-7));
		margin-inline: auto;
	}

	main {
		display: flex;
		flex-direction: column;
		gap: var(--sp-7);
	}

	.grid {
		display: grid;
		/* min(380px, 100%): the card minimum yields when the CONTAINER is the narrower party, so a
		   phone gets one fitted column instead of a 380px track and a horizontal scrollbar.
		   `auto-fit` (not auto-fill) is load-bearing: it COLLAPSES the tracks nothing sits in, which
		   is what lets two cards fill a three-card measure instead of huddling at the left. */
		grid-template-columns: repeat(auto-fit, minmax(min(380px, 100%), 1fr));
		gap: var(--sp-7);
		align-content: start;
		/* Each card takes its OWN height. Without this, grid rows stretch every card to the tallest in
		   the row, so opening one card's assay or ablation matrix dragged its silent neighbours taller
		   with it — a card should answer for its own content and nobody else's. */
		align-items: start;
	}

	/* The one card that holds nothing: an empty slot inviting a new experiment. */
	.ghost {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--sp-3);
		min-height: 64px;
		border: 1.5px dashed var(--line);
		border-radius: var(--radius-card);
		background: transparent;
		color: var(--ink3);
		font-size: var(--fs-body);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition:
			color var(--dur) var(--ease),
			border-color var(--dur) var(--ease),
			background var(--dur) var(--ease);
	}

	.ghost:hover {
		border-color: var(--accent);
		background: var(--panel);
		color: var(--accent);
	}
</style>
