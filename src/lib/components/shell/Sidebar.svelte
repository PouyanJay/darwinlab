<!--
  The lab's control column.

  Everything you DO to the bench lives here, grouped the way you reach for it:

    RUN         how time advances — evolve/pause, speed, and a training burst
    EXPERIMENT  what is being run — the seed and config it is pinned to, and the environments in it

  The top bar keeps only what is not a control (identity, the scenario) plus settings and theme, so
  there is exactly one place to look for an action.

  It is DOCKED and resizable on a desktop, and an OVERLAY on a phone, where there is no room to dock
  anything. Collapsed, it leaves a rail behind rather than vanishing: the run controls are what you
  reach for mid-experiment, and a control you have to re-open a panel to press is a control you stop
  using. Which of the three it is doing is the shell store's answer, not this component's.
-->
<script lang="ts">
	import Button from '../common/Button.svelte';
	import Segmented from '../common/Segmented.svelte';
	import TransportIcon from '../common/TransportIcon.svelte';
	import RunManifest from '../topbar/RunManifest.svelte';
	import SidebarRail from './SidebarRail.svelte';
	import SidebarResizer from './SidebarResizer.svelte';
	import { trainTarget, trainLabel } from './train';
	import { bench, shell, SPEEDS } from '$lib/state';

	interface Props {
		onaddworld: () => void;
		onplaystory: () => void;
	}

	let { onaddworld, onplaystory }: Props = $props();

	const training = $derived(bench.turboTarget !== null);
	const target = $derived(trainTarget(bench.generationsEvolved, bench.maxGenerations));
	const label = $derived(trainLabel(bench.maxGenerations));

	/**
	 * On the narrow layout the panel floats over the bench, so anything that TAKES the screen has to
	 * shut it on the way out — otherwise the film plays behind an open control panel, and a new world
	 * scrolls into view underneath one.
	 */
	function andClose(run: () => void) {
		return () => {
			run();
			shell.closeOverlay();
		};
	}
</script>

<!--
  The rail is docked whenever the panel is not filling its place: shut, it IS the sidebar; on a phone
  it stays put under the open overlay, because removing it there would shift the whole bench sideways
  every time the panel opened.
-->
{#if !shell.open || shell.narrow}
	<SidebarRail {onaddworld} {onplaystory} />
{/if}

{#if shell.open}
	<!-- Only the OVERLAY gets a scrim; a docked panel is part of the page, not on top of it. -->
	{#if shell.narrow}
		<button
			type="button"
			class="scrim"
			aria-label="close the controls"
			onclick={() => shell.closeOverlay()}
		></button>
	{/if}

	<div
		class="sidebar"
		class:overlay={shell.narrow}
		style:width="{shell.width}px"
		aria-label="lab controls"
	>
		<nav>
			<header>
				<span class="title">Controls</span>
				<Button
					variant="icon"
					size="sm"
					aria-label="collapse the controls"
					aria-expanded={true}
					title="collapse the controls"
					onclick={() => shell.toggle()}
				>
					<span aria-hidden="true">«</span>
				</Button>
			</header>

			<section>
				<h2 class="field-label">Run</h2>

				<p class="readout">
					<span class="glyph" aria-hidden="true">⟳</span>
					<b class="tabular" data-testid="generations">{bench.generationsEvolved}</b>
					<span>episodes</span>
				</p>

				<!-- No aria-label on a button that carries visible text: an aria-label REPLACES the label
				     a sighted user reads with a different one AT hears — the mismatch WCAG's "label in
				     name" is about. Only the glyph-only buttons (the rail's) get one. -->
				<Button variant="primary" class="wide" onclick={() => bench.togglePlay()}>
					<TransportIcon playing={bench.running} />
					<span>{bench.running ? 'Pause' : 'Evolve'}</span>
				</Button>

				<div class="field">
					<span class="field-label" id="speed-label">Speed</span>
					<Segmented
						label="simulation speed"
						options={SPEEDS}
						value={bench.speed}
						onchange={(speed) => bench.setSpeed(speed)}
					/>
				</div>

				<Button class="wide" disabled={training} onclick={() => bench.trainTo(target)}>
					<span aria-hidden="true">⏩</span>
					<span>{label}</span>
				</Button>
			</section>

			<section>
				<h2 class="field-label">Experiment</h2>

				<RunManifest />

				<Button class="wide" onclick={andClose(onaddworld)}>
					<span aria-hidden="true">＋</span>
					<span>Add environment</span>
				</Button>

				<Button variant="accent" class="wide" disabled={training} onclick={andClose(onplaystory)}>
					<TransportIcon playing={false} size={9} />
					<span>Play story</span>
				</Button>
			</section>
		</nav>

		<!-- Docked only: there is nothing to resize when the panel is floating over the page. -->
		{#if !shell.narrow}
			<SidebarResizer />
		{/if}
	</div>
{/if}

<style>
	.sidebar {
		position: sticky;
		top: var(--topbar-height);
		z-index: var(--z-sidebar);
		flex: none;
		align-self: flex-start;
		display: flex;
		height: calc(100vh - var(--topbar-height));
		border-right: 1px solid var(--line);
		background: var(--panel);
	}

	/* No room to dock: the panel comes over the bench, off the left edge, above its own scrim. */
	.overlay {
		position: fixed;
		top: var(--topbar-height);
		left: 0;
		z-index: var(--z-sidebar-overlay);
		max-width: calc(100vw - 64px); /* the rail stays uncovered, so the way out stays visible */
		box-shadow: var(--shadow-drawer);
		animation: slide-in-left var(--dur-enter) var(--ease) both;
	}

	.scrim {
		position: fixed;
		inset: var(--topbar-height) 0 0;
		z-index: var(--z-sidebar-scrim);
		border: none;
		padding: 0;
		background: var(--scrim);
		backdrop-filter: blur(var(--blur-scrim));
		cursor: default;
		animation: fade-in var(--dur-fast) var(--ease) both;
	}

	nav {
		flex: 1;
		min-width: 0; /* a dragged-narrow panel clips its content instead of pushing the divider */
		display: flex;
		flex-direction: column;
		gap: var(--sp-7);
		padding: var(--sp-4) var(--sp-5) var(--sp-6);
		overflow-y: auto;
	}

	nav > header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: calc(-1 * var(--sp-3)); /* the section gap is enough on its own */
	}

	.title {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--ink3);
	}

	section {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	section h2 {
		margin: 0 0 var(--sp-1);
	}

	/* Every control in the column is full-bleed: a ragged right edge in a 268px panel reads as five
	   unrelated widgets rather than one instrument. */
	.sidebar :global(.wide) {
		width: 100%;
		justify-content: flex-start;
	}

	.sidebar :global(.manifest) {
		width: 100%;
		justify-content: flex-start;
		padding: var(--sp-3) var(--sp-4);
	}

	.field {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
		padding: 2px 0;
	}

	.readout {
		display: flex;
		align-items: baseline;
		gap: 7px;
		margin: 0 0 var(--sp-1);
		font-size: var(--fs-md);
		color: var(--ink3);
	}

	.readout b {
		font-size: var(--fs-stat);
		font-weight: var(--fw-semibold);
		color: var(--ink);
	}

	.glyph {
		align-self: center;
		color: var(--accent);
	}
</style>
