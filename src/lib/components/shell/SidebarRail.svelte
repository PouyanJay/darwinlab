<!--
  The rail: what the sidebar leaves behind when it is shut.

  A collapse that hides play/pause is a collapse nobody uses twice - mid-experiment you are pausing,
  changing speed and firing training bursts constantly. So the rail keeps every RUN control (as
  icons, each with a real label) and drops only the reading matter.

  The one control that changes shape is speed: a three-way segmented control does not fit 56px, so
  the rail offers the same three values as a CYCLE - press to step ½× → 1× → 2× → ½×. It shows the
  value it is on, so it reads as much as it acts.

  It is inert while the panel is open: on a phone it sits under the panel's scrim, and either way the
  same controls must not be offered to a screen reader twice.
-->
<script lang="ts">
	import Button from '../common/Button.svelte';
	import Icon from '../common/Icon.svelte';
	import TransportIcon from '../common/TransportIcon.svelte';
	import { trainTarget, trainLabel } from './train';
	import { bench, shell, SPEEDS } from '$lib/state';

	interface Props {
		onaddworld: () => void;
		onplaystory: () => void;
		/** "Fit the tree", when the lineage canvas is showing. On a phone its own zoom cluster is hidden,
		    so this rides in the pill; absent (the focus view, or desktop) the button is not offered. */
		onrecenter?: () => void;
	}

	let { onaddworld, onplaystory, onrecenter }: Props = $props();

	const speed = $derived(SPEEDS.find((option) => option.value === bench.speed) ?? SPEEDS[1]);
	const train = $derived(trainLabel(bench.maxGenerations));

	function cycleSpeed() {
		const next = (SPEEDS.findIndex((option) => option.value === bench.speed) + 1) % SPEEDS.length;
		bench.setSpeed(SPEEDS[next].value);
	}
</script>

<!-- Labelled the same as the panel, and for the same reason (see Sidebar.svelte). Both are only ever
     in the page at once on a phone, where this one is inert underneath the other. -->
<aside class="rail" aria-label="lab controls" inert={shell.open}>
	<Button
		variant="icon"
		aria-label="expand the controls"
		aria-expanded={shell.open}
		title="expand the controls"
		onclick={() => shell.toggle()}
	>
		<!-- Desktop: a chevron that opens the panel docked to the right. Phone: the pill is horizontal
		     and the full controls arrive as a bottom sheet, so a "sliders" glyph reads as "more" better
		     than a sideways chevron would. -->
		<Icon name={shell.narrow ? 'sliders' : 'chevron-right'} />
	</Button>

	{#if !shell.open}
		<span class="divider" aria-hidden="true"></span>

		<Button
			variant="icon"
			aria-label={bench.running ? 'Pause' : 'Evolve'}
			title={bench.running ? 'pause' : 'evolve'}
			onclick={() => bench.togglePlay()}
		>
			<TransportIcon playing={bench.running} />
		</Button>

		<Button
			variant="icon"
			class="speed tabular"
			aria-label="simulation speed: {speed.label}, press to change"
			title="speed: {speed.label}"
			onclick={cycleSpeed}
		>
			{speed.label}
		</Button>

		<Button
			variant="icon"
			aria-label={train}
			title={train}
			disabled={bench.training}
			onclick={() => bench.trainTo(trainTarget(bench.generationsEvolved, bench.maxGenerations))}
		>
			<Icon name="forward" />
		</Button>

		<span class="divider" aria-hidden="true"></span>

		<Button
			variant="icon"
			aria-label="Add environment"
			title="add environment"
			onclick={onaddworld}
		>
			<Icon name="plus" />
		</Button>

		<Button
			variant="icon"
			class="story"
			aria-label="Play story"
			title="play story"
			disabled={bench.training}
			onclick={onplaystory}
		>
			<TransportIcon playing={false} size={9} />
		</Button>

		<!-- Phone only: the lineage canvas hides its own zoom cluster there, so "fit the tree" rides in
		     the pill. Absent on the focus view (no tree to fit) and on desktop (the canvas keeps its own). -->
		{#if shell.narrow && onrecenter}
			<Button variant="icon" aria-label="recenter the tree" title="recenter" onclick={onrecenter}>
				<Icon name="crosshair" />
			</Button>
		{/if}
	{/if}
</aside>

<style>
	.rail {
		position: sticky;
		top: var(--topbar-height);
		z-index: var(--z-sidebar);
		flex: none;
		align-self: flex-start;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-2);
		width: var(--rail-width);
		height: calc(100vh - var(--topbar-height));
		padding: var(--sp-4) 0;
		border-right: 1px solid var(--line);
		background: var(--panel2);
	}

	.divider {
		width: 20px;
		height: 1px;
		margin: var(--sp-2) 0;
		background: var(--line);
	}

	.rail :global(.speed) {
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
	}

	.rail :global(.story) {
		color: var(--accent);
	}

	/*
	 * Phone (the narrow layout, matching the shell's overlay switch): the left rail becomes a FLOATING
	 * BOTTOM PILL. No docked strip eating the width and no per-button boxes - one glass pill of bare
	 * icons, thumb-reachable at the bottom. The "more" button (the expand control) moves to the end and
	 * opens the full controls as a bottom sheet. It keeps the shell's z-index, so its own scrim covers
	 * it when the sheet is up.
	 */
	@media (max-width: 900px) {
		.rail {
			position: fixed;
			top: auto;
			left: 50%;
			bottom: calc(env(safe-area-inset-bottom, 0px) + var(--sp-4));
			transform: translateX(-50%);
			flex-direction: row;
			align-items: center;
			width: auto;
			max-width: calc(100vw - 2 * var(--sp-4));
			height: auto;
			padding: var(--sp-1) var(--sp-2);
			gap: 2px;
			border: 1px solid var(--line);
			border-radius: var(--radius-pill);
			background: var(--glass);
			backdrop-filter: blur(var(--blur-glass));
			box-shadow: var(--shadow-pill);
		}

		/* The rail's group dividers are a vertical-stack affordance; the compact pill spaces its icons
		   evenly instead, with the "more" button set off at the end. */
		.rail .divider {
			display: none;
		}

		/* Bare icons in the pill - the glass IS the container, so the buttons drop their own boxes. */
		.rail :global(.btn) {
			border-color: transparent;
			background: none;
			box-shadow: none;
		}

		.rail :global(.btn:not(:disabled):hover) {
			background: var(--chip);
		}

		/* "More" (the expand button, the first child) to the end of the pill, with a hairline before it. */
		.rail :global(.btn:first-child) {
			order: 1;
			margin-left: var(--sp-1);
			border-left: 1px solid var(--line);
			border-radius: 0 var(--radius-pill) var(--radius-pill) 0;
		}
	}
</style>
